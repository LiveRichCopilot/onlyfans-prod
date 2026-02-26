import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMassMessageStats } from "@/lib/ofapi-engagement";
import { listChats, getChatMessages } from "@/lib/ofapi-chat";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

// Time windows in milliseconds
const WINDOWS = {
  w30m: 30 * 60 * 1000,
  w1h: 60 * 60 * 1000,
  w6h: 6 * 60 * 60 * 1000,
  w24h: 24 * 60 * 60 * 1000,
} as const;

type WindowSets = { w30m: Set<string>; w1h: Set<string>; w6h: Set<string>; w24h: Set<string> };
type WindowCounts = { w30m: number; w1h: number; w6h: number; w24h: number };

/**
 * GET /api/cron/mass-reply-attribution
 *
 * Runs every 30 min. For each creator, fetches mass messages sent in the last 48h,
 * then scans recent chat activity for inbound fan messages that arrived within
 * 30m / 1h / 6h / 24h of each mass message send time.
 *
 * Stores unique replier counts per window in MassMessageReply table.
 * Processes 2-3 creators per run (round-robin via computedAt).
 */
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const requestStart = Date.now();
  const now = new Date();
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  try {
    // Get creators with OFAPI access, ordered by least recently computed
    const creators = await prisma.creator.findMany({
      where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
      select: { id: true, name: true, ofapiCreatorId: true, ofapiToken: true },
    });

    if (creators.length === 0) {
      return NextResponse.json({ message: "No creators", processed: 0 });
    }

    // Get last computed time per creator to round-robin
    const recentReplies = await prisma.massMessageReply.groupBy({
      by: ["creatorId"],
      _max: { computedAt: true },
    });
    const lastComputed = new Map(recentReplies.map((r: { creatorId: string; _max: { computedAt: Date | null } }) => [r.creatorId, r._max.computedAt?.getTime() || 0]));

    // Sort creators by least recently processed
    const sortedCreators = [...creators].sort((a, b) =>
      (lastComputed.get(a.id) || 0) - (lastComputed.get(b.id) || 0)
    );

    let processed = 0;
    let totalUpserts = 0;

    for (const creator of sortedCreators) {
      // Time guard: leave 20s buffer
      if (Date.now() - requestStart > 100_000) {
        console.log(`[mass-reply] Time guard at ${processed} creators`);
        break;
      }

      try {
        const result = await processCreator(
          creator as { id: string; name: string | null; ofapiCreatorId: string; ofapiToken: string },
          cutoff48h, now
        );
        totalUpserts += result;
        processed++;
        console.log(`[mass-reply] ${creator.name}: ${result} messages attributed`);
      } catch (err) {
        console.error(`[mass-reply] Error for ${creator.name}:`, err instanceof Error ? err.message : err);
      }

      // Process max 2 creators per run
      if (processed >= 2) break;
    }

    const elapsed = Date.now() - requestStart;
    console.log(`[mass-reply] Done in ${elapsed}ms — ${processed} creators, ${totalUpserts} upserts`);

    return NextResponse.json({ processed, totalUpserts, elapsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mass-reply] Fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Process one creator: fetch mass messages, scan chats, compute reply windows */
async function processCreator(
  creator: { id: string; name: string | null; ofapiCreatorId: string; ofapiToken: string },
  cutoff: Date, now: Date
): Promise<number> {
  // 1) Get mass messages from last 48h
  const massRes = await getMassMessageStats(
    creator.ofapiCreatorId, creator.ofapiToken, cutoff, now, 50, 0
  );
  const massItems = (massRes as any)?.data?.items || (massRes as any)?.items || (massRes as any)?.data?.list || [];

  if (massItems.length === 0) return 0;

  // Parse mass messages with send times
  const massMessages: { id: string; sentAt: Date; sentCount: number }[] = [];
  for (const item of massItems) {
    const id = String(item.id || item.messageId || "");
    const date = item.date || item.createdAt;
    if (!id || !date) continue;
    massMessages.push({
      id,
      sentAt: new Date(date),
      sentCount: item.sentCount || 0,
    });
  }

  if (massMessages.length === 0) return 0;

  // Earliest mass message time (for filtering chats)
  const earliestSend = Math.min(...massMessages.map(m => m.sentAt.getTime()));

  // 2) Get recent chats (sorted by recent activity)
  const chatRes = await listChats(creator.ofapiCreatorId, creator.ofapiToken, 50, 0);
  const chats = Array.isArray((chatRes as any)?.data)
    ? (chatRes as any).data
    : (chatRes as any)?.data?.list || [];

  // 3) Initialize reply tracking per mass message
  const replyMap = new Map<string, { uniques: WindowSets; counts: WindowCounts }>();
  for (const mm of massMessages) {
    replyMap.set(mm.id, {
      uniques: { w30m: new Set(), w1h: new Set(), w6h: new Set(), w24h: new Set() },
      counts: { w30m: 0, w1h: 0, w6h: 0, w24h: 0 },
    });
  }

  // 4) Scan chats for inbound messages — parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < chats.length; i += batchSize) {
    const batch = chats.slice(i, i + batchSize);
    await Promise.all(batch.map(async (chat: any) => {
      const fanId = String(chat.withUser?.id || chat.fan?.id || chat.id || "");
      if (!fanId) return;

      try {
        const msgRes = await getChatMessages(creator.ofapiCreatorId, fanId, creator.ofapiToken, 30);
        const messages = (msgRes as any)?.data?.list || (msgRes as any)?.list
          || (Array.isArray((msgRes as any)?.data) ? (msgRes as any).data : []);

        for (const m of messages) {
          const fromId = String(m.fromUser?.id || m.author?.id || "");
          // Inbound = from the fan (fromId matches fanId)
          if (fromId !== fanId) continue;

          const msgTime = new Date(m.createdAt || m.date || "").getTime();
          if (isNaN(msgTime) || msgTime < earliestSend) continue;

          // Attribute to the most recent mass message sent BEFORE this inbound message
          for (const mm of massMessages) {
            const delta = msgTime - mm.sentAt.getTime();
            if (delta < 0) continue; // message before this mass send

            const tracking = replyMap.get(mm.id);
            if (!tracking) continue;

            if (delta <= WINDOWS.w30m) {
              tracking.uniques.w30m.add(fanId);
              tracking.counts.w30m++;
            }
            if (delta <= WINDOWS.w1h) {
              tracking.uniques.w1h.add(fanId);
              tracking.counts.w1h++;
            }
            if (delta <= WINDOWS.w6h) {
              tracking.uniques.w6h.add(fanId);
              tracking.counts.w6h++;
            }
            if (delta <= WINDOWS.w24h) {
              tracking.uniques.w24h.add(fanId);
              tracking.counts.w24h++;
            }
          }
        }
      } catch { /* skip failed chat fetches */ }
    }));
  }

  // 5) Upsert results
  let upserts = 0;
  for (const mm of massMessages) {
    const tracking = replyMap.get(mm.id)!;
    await prisma.massMessageReply.upsert({
      where: { creatorId_massMessageId: { creatorId: creator.id, massMessageId: mm.id } },
      create: {
        creatorId: creator.id,
        massMessageId: mm.id,
        sentAt: mm.sentAt,
        sentCount: mm.sentCount,
        uniqueRepliers30m: tracking.uniques.w30m.size,
        uniqueRepliers1h: tracking.uniques.w1h.size,
        uniqueRepliers6h: tracking.uniques.w6h.size,
        uniqueRepliers24h: tracking.uniques.w24h.size,
        inboundCount30m: tracking.counts.w30m,
        inboundCount1h: tracking.counts.w1h,
        inboundCount6h: tracking.counts.w6h,
        inboundCount24h: tracking.counts.w24h,
        replyRate24h: mm.sentCount > 0 ? tracking.uniques.w24h.size / mm.sentCount : 0,
      },
      update: {
        sentAt: mm.sentAt,
        sentCount: mm.sentCount,
        uniqueRepliers30m: tracking.uniques.w30m.size,
        uniqueRepliers1h: tracking.uniques.w1h.size,
        uniqueRepliers6h: tracking.uniques.w6h.size,
        uniqueRepliers24h: tracking.uniques.w24h.size,
        inboundCount30m: tracking.counts.w30m,
        inboundCount1h: tracking.counts.w1h,
        inboundCount6h: tracking.counts.w6h,
        inboundCount24h: tracking.counts.w24h,
        replyRate24h: mm.sentCount > 0 ? tracking.uniques.w24h.size / mm.sentCount : 0,
        computedAt: new Date(),
      },
    });
    upserts++;
  }

  return upserts;
}

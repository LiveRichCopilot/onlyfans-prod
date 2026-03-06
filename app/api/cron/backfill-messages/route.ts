import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listChats, getChatMessages } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for Vercel Pro

/**
 * GET /api/cron/backfill-messages?creatorId=xxx
 *
 * One-time backfill for creators with zero (or few) RawChatMessages.
 * - If ?creatorId=xxx is provided, backfills only that creator.
 * - If omitted, finds all active creators with zero recent messages and backfills them all.
 *
 * Fetches last 100 chats per creator, 50 messages per chat.
 * Uses RawChatMessage createMany with skipDuplicates for safe re-runs.
 */
export async function GET(req: NextRequest) {
  // Auth check
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const creatorIdParam = req.nextUrl.searchParams.get("creatorId");
    const apiKey = process.env.OFAPI_API_KEY || "";

    let creators;

    if (creatorIdParam) {
      // Backfill a specific creator
      creators = await prisma.creator.findMany({
        where: {
          id: creatorIdParam,
          active: true,
          ofapiToken: { not: null },
          ofapiCreatorId: { not: null },
        },
        select: { id: true, name: true, ofapiCreatorId: true, ofapiToken: true },
      });
    } else {
      // Find all active creators, then filter to those with zero recent messages
      const allCreators = await prisma.creator.findMany({
        where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
        select: { id: true, name: true, ofapiCreatorId: true, ofapiToken: true },
      });

      // Count messages per creator in last 48 hours
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const counts = await prisma.rawChatMessage.groupBy({
        by: ["creatorId"],
        where: { sentAt: { gte: cutoff } },
        _count: { id: true },
      });

      const countMap = new Map(counts.map((c) => [c.creatorId, c._count.id]));

      // Only backfill creators with zero recent messages
      creators = allCreators.filter((c) => !countMap.has(c.id) || countMap.get(c.id)! === 0);
    }

    if (creators.length === 0) {
      return NextResponse.json({ status: "ok", message: "No creators need backfill" });
    }

    const results: Array<{ name: string | null; id: string; chats: number; messages: number; error?: string }> = [];

    for (const creator of creators) {
      const acctId = creator.ofapiCreatorId!;
      const token = creator.ofapiToken === "linked_via_auth_module" ? apiKey : creator.ofapiToken!;
      let creatorChats = 0;
      let creatorMessages = 0;

      try {
        // Fetch up to 100 chats in two pages of 50
        const allChats: any[] = [];

        for (let offset = 0; offset < 100; offset += 50) {
          const chatData = await listChats(acctId, token, 50, offset);
          const chats = Array.isArray(chatData?.data) ? chatData.data : chatData?.data?.list || [];
          allChats.push(...chats);
          if (chats.length < 50) break; // No more pages
        }

        for (const chat of allChats) {
          const chatId = String(chat.withUser?.id || chat.fan?.id || chat.id);
          if (!chatId) continue;
          creatorChats++;

          try {
            // Fetch up to 50 messages per chat
            const msgData = await getChatMessages(acctId, chatId, token, 50);
            const msgs = msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);

            if (msgs.length === 0) continue;

            const rows = msgs.map((m: any) => ({
              ofMessageId: String(m.id),
              creatorId: creator.id,
              chatId,
              fromUserId: String(m.fromUser?.id || ""),
              isFromCreator: String(m.fromUser?.id || "") !== chatId,
              text: m.text || null,
              price: m.price || 0,
              isFree: m.isFree !== false,
              mediaCount: m.mediaCount || m.media?.length || 0,
              isLiked: m.isLiked || false,
              isTip: m.isTip || false,
              tipAmount: m.tipAmount || 0,
              raw: m,
              sentAt: new Date(m.createdAt),
            }));

            const result = await prisma.rawChatMessage.createMany({
              data: rows,
              skipDuplicates: true,
            });

            creatorMessages += result.count;

            // Update sync cursor to newest message so future syncs continue from here
            const newestId = String(msgs[0].id);
            await prisma.syncCursor.upsert({
              where: {
                creatorId_dataType_chatId: {
                  creatorId: creator.id,
                  dataType: "chat_messages",
                  chatId,
                },
              },
              create: {
                creatorId: creator.id,
                dataType: "chat_messages",
                chatId,
                lastSeenId: newestId,
              },
              update: {
                lastSeenId: newestId,
                lastSyncAt: new Date(),
              },
            });
          } catch (chatErr: any) {
            console.error(`[backfill] Chat ${chatId} error for ${creator.name}:`, chatErr.message);
          }
        }

        results.push({ name: creator.name, id: creator.id, chats: creatorChats, messages: creatorMessages });
      } catch (e: any) {
        console.error(`[backfill] Creator ${creator.name} (${acctId}) error:`, e.message);
        results.push({ name: creator.name, id: creator.id, chats: creatorChats, messages: creatorMessages, error: e.message });
      }
    }

    const totalMessages = results.reduce((sum, r) => sum + r.messages, 0);
    const totalChats = results.reduce((sum, r) => sum + r.chats, 0);

    console.log(`[backfill] Done. ${totalMessages} messages from ${totalChats} chats across ${results.length} creators`);

    return NextResponse.json({
      status: "ok",
      creatorsProcessed: results.length,
      totalChats,
      totalMessages,
      details: results,
    });
  } catch (err: any) {
    console.error("[backfill] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

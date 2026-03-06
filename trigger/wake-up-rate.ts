/**
 * Wake Up Rate — "How many fans replied after this post?"
 *
 * Every 30 min for first 6h, then hourly to 8h: 30m,1h,1h30,2h,...,5h30,6h,7h,8h
 * Counts ALL fans who sent an inbound message after the mass message.
 * Result: simple counts like "50 fans replied at 30m, 120 at 1h, 180 at 1h30..."
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

// Every 30 min to 6h, then hourly to 24h — all in minutes
const BUCKETS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 420, 480, 540, 600, 660, 720, 840, 960, 1080, 1200, 1320, 1440];

function clampToNow(d: Date, now: Date) {
  return d.getTime() > now.getTime() ? now : d;
}

async function computeWakeUps(creatorId: string, T0: Date, now: Date) {
  const maxWindow = clampToNow(new Date(T0.getTime() + 360 * 60_000), now);

  // 1) All fans who sent an inbound message after the post
  const firstInboundByChat = await prisma.rawChatMessage.groupBy({
    by: ["chatId"],
    where: {
      creatorId,
      isFromCreator: false,
      sentAt: { gt: T0, lte: maxWindow },
    },
    _min: { sentAt: true },
  });

  // 2) Outbound chatter DMs after the mass message (for each bucket)
  const chatterDMsBuckets: Record<string, number> = {};
  for (const mins of BUCKETS) {
    const cutoff = clampToNow(new Date(T0.getTime() + mins * 60_000), now);
    if (cutoff.getTime() <= T0.getTime()) { chatterDMsBuckets[String(mins)] = 0; continue; }
    const count = await prisma.rawChatMessage.count({
      where: { creatorId, isFromCreator: true, sentAt: { gt: T0, lte: cutoff } },
    });
    chatterDMsBuckets[String(mins)] = count;
  }

  if (firstInboundByChat.length === 0) {
    const emptyBuckets: Record<string, number> = {};
    for (const mins of BUCKETS) emptyBuckets[String(mins)] = 0;
    return { totalReplied: 0, wakeUpBuckets: emptyBuckets, chatterDMs: chatterDMsBuckets };
  }

  // 3) All responder first-reply timestamps per bucket
  const allWakeUps = firstInboundByChat
    .map((r) => r._min.sentAt!)
    .filter(Boolean);

  const wakeUpBuckets: Record<string, number> = {};
  for (const mins of BUCKETS) {
    const cutoff = clampToNow(new Date(T0.getTime() + mins * 60_000), now);
    wakeUpBuckets[String(mins)] = allWakeUps.filter((t) => t <= cutoff).length;
  }

  return {
    totalReplied: firstInboundByChat.length,
    wakeUpBuckets,
    chatterDMs: chatterDMsBuckets,
  };
}

export const wakeUpRate = task({
  id: "wake-up-rate",
  retry: { maxAttempts: 1 },
  run: async (payload: { limit?: number; creatorId?: string; recompute?: boolean }) => {
    const limit = payload.limit || 50;
    const now = new Date();

    const minAge = new Date(now.getTime() - 15 * 60 * 1000);
    const maxAge = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const where: any = {
      mediaCount: { gt: 0 },
      sentAt: { lt: minAge, gt: maxAge },
    };
    if (!payload.recompute) where.wakeUpComputed = false;
    if (payload.creatorId) where.creatorId = payload.creatorId;

    const pushEvents = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
      select: { id: true, creatorId: true, sentAt: true, sentCount: true },
    });

    if (pushEvents.length === 0) {
      return { computed: 0, message: "No posts needing wake-up computation" };
    }

    let computed = 0;

    for (const push of pushEvents) {
      try {
        const T0 = new Date(push.sentAt);
        const result = await computeWakeUps(push.creatorId, T0, now);

        await prisma.outboundCreative.update({
          where: { id: push.id },
          data: {
            dormantBefore: result.totalReplied,
            wakeUpBuckets: result.wakeUpBuckets,
            chatterDMs: result.chatterDMs,
            // Legacy columns
            wakeUp30m: result.wakeUpBuckets["30"] ?? 0,
            wakeUp1h: result.wakeUpBuckets["60"] ?? 0,
            wakeUp3h: result.wakeUpBuckets["180"] ?? 0,
            wakeUp6h: result.wakeUpBuckets["360"] ?? 0,
            wakeUp24h: result.wakeUpBuckets["360"] ?? 0,
            chatterDMs1h: result.chatterDMs["60"] ?? 0,
            chatterDMs3h: result.chatterDMs["180"] ?? 0,
            wakeUpComputed: true,
            wakeUpComputedAt: now,
          },
        });

        const b = result.wakeUpBuckets;
        console.log(`[WakeUp] ${push.id}: 30m=${b["30"]} 1h=${b["60"]} 1h30=${b["90"]} 2h=${b["120"]} 3h=${b["180"]} (${result.totalReplied} total replied)`);
        computed++;
      } catch (e: any) {
        console.error(`[WakeUp] ${push.id}: ${e.message}`);
      }
    }

    return { computed, total: pushEvents.length };
  },
});

export const wakeUpRateScheduled = schedules.task({
  id: "wake-up-rate-scheduled",
  cron: "*/15 * * * *",
  run: async () => {
    const result = await wakeUpRate.triggerAndWait({ limit: 50, recompute: true });
    return result;
  },
});

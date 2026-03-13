/**
 * Wake Up Rate — "How many cold fans started chatting after this post?"
 *
 * Every 30 min for first 6h, then hourly to 8h: 30m,1h,1h30,2h,...,5h30,6h,7h,8h
 * A "cold fan" = hadn't chatted in 3+ days before the mass message.
 * Result: simple counts like "50 fans woke up at 30m, 120 at 1h, 180 at 1h30..."
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const DORMANT_DAYS = 3;

// Every 30 min to 6h, then hourly to 24h — all in minutes
const BUCKETS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 420, 480, 540, 600, 660, 720, 840, 960, 1080, 1200, 1320, 1440];

function clampToNow(d: Date, now: Date) {
  return d.getTime() > now.getTime() ? now : d;
}

async function computePurchaseBuckets(creatorId: string, T0: Date, creativeId: string, isFree: boolean, now: Date): Promise<Record<string, number>> {
  const empty: Record<string, number> = {};
  for (const mins of BUCKETS) empty[String(mins)] = 0;
  if (isFree) return empty;

  // Find the NEXT PPV mass message for this creator — transactions between T0 and nextT0 belong to this message
  const nextPPV = await prisma.outboundCreative.findFirst({
    where: {
      creatorId,
      isFree: false,
      sentAt: { gt: T0 },
      id: { not: creativeId },
    },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true },
  });

  const maxWindow24h = new Date(T0.getTime() + 1440 * 60_000);
  const upperBound = nextPPV ? new Date(Math.min(nextPPV.sentAt.getTime(), maxWindow24h.getTime())) : maxWindow24h;
  const maxWindow = clampToNow(upperBound, now);

  // Find "message" transactions for this creator in the window
  const txDates = await prisma.transaction.findMany({
    where: {
      creatorId,
      type: { contains: "message" },
      amount: { gt: 0 },
      date: { gt: T0, lte: maxWindow },
    },
    select: { date: true },
  });

  if (txDates.length === 0) return empty;

  const buckets: Record<string, number> = {};
  for (const mins of BUCKETS) {
    const cutoff = clampToNow(new Date(T0.getTime() + mins * 60_000), now);
    buckets[String(mins)] = txDates.filter((t) => t.date <= cutoff).length;
  }
  return buckets;
}

async function computeWakeUps(creatorId: string, T0: Date, now: Date) {
  const dormantCutoff = new Date(T0.getTime() - DORMANT_DAYS * 24 * 3600_000);
  const maxWindow = clampToNow(new Date(T0.getTime() + 1440 * 60_000), now);

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
    return { totalReplied: 0, coldFanCount: 0, wakeUpBuckets: emptyBuckets, chatterDMs: chatterDMsBuckets };
  }

  const responderChatIds = firstInboundByChat.map((r) => r.chatId);

  // 3) Find which responders had chat activity in the 3 days before the post
  const activeBeforePost = await prisma.rawChatMessage.groupBy({
    by: ["chatId"],
    where: {
      creatorId,
      chatId: { in: responderChatIds },
      sentAt: { gte: dormantCutoff, lte: T0 },
    },
  });

  const activeSet = new Set(activeBeforePost.map((a) => a.chatId));

  // 4) Cold fan wake-ups per bucket
  const coldWakeUps = firstInboundByChat
    .filter((r) => !activeSet.has(r.chatId))
    .map((r) => r._min.sentAt!)
    .filter(Boolean);

  const wakeUpBuckets: Record<string, number> = {};
  for (const mins of BUCKETS) {
    const cutoff = clampToNow(new Date(T0.getTime() + mins * 60_000), now);
    wakeUpBuckets[String(mins)] = coldWakeUps.filter((t) => t <= cutoff).length;
  }

  // 5) Inactivity duration buckets — how long each replying fan was dormant BEFORE this message
  const reactivationBuckets: Record<string, number> = { "3d": 0, "7d": 0, "15d": 0, "30d": 0 };

  if (responderChatIds.length > 0) {
    // For each replying fan, find their last message before this mass message
    const lastActivityByChat = await prisma.rawChatMessage.groupBy({
      by: ["chatId"],
      where: {
        creatorId,
        chatId: { in: responderChatIds },
        sentAt: { lt: T0 },
      },
      _max: { sentAt: true },
    });

    const lastActivityMap = new Map(lastActivityByChat.map((r) => [r.chatId, r._max.sentAt]));

    for (const chatId of responderChatIds) {
      const lastSeen = lastActivityMap.get(chatId);
      let inactiveDays: number;
      if (!lastSeen) {
        // Never chatted before = 30d (max bucket)
        inactiveDays = 30;
      } else {
        inactiveDays = Math.floor((T0.getTime() - lastSeen.getTime()) / 86400_000);
        if (inactiveDays > 30) inactiveDays = 30; // Cap at 30d
      }

      if (inactiveDays >= 30) reactivationBuckets["30d"]++;
      if (inactiveDays >= 15) reactivationBuckets["15d"]++;
      if (inactiveDays >= 7) reactivationBuckets["7d"]++;
      if (inactiveDays >= 3) reactivationBuckets["3d"]++;
    }
  }

  return {
    totalReplied: firstInboundByChat.length,
    coldFanCount: coldWakeUps.length,
    wakeUpBuckets,
    chatterDMs: chatterDMsBuckets,
    reactivationBuckets,
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
      select: { id: true, creatorId: true, sentAt: true, sentCount: true, isFree: true },
    });

    if (pushEvents.length === 0) {
      return { computed: 0, message: "No posts needing wake-up computation" };
    }

    let computed = 0;

    for (const push of pushEvents) {
      try {
        const T0 = new Date(push.sentAt);
        const result = await computeWakeUps(push.creatorId, T0, now);
        const purchases = await computePurchaseBuckets(push.creatorId, T0, push.id, push.isFree, now);

        await prisma.outboundCreative.update({
          where: { id: push.id },
          data: {
            dormantBefore: result.coldFanCount,
            wakeUpBuckets: result.wakeUpBuckets,
            chatterDMs: result.chatterDMs,
            purchaseBuckets: purchases,
            reactivationBuckets: result.reactivationBuckets,
            // Legacy columns
            wakeUp30m: result.wakeUpBuckets["30"] ?? 0,
            wakeUp1h: result.wakeUpBuckets["60"] ?? 0,
            wakeUp3h: result.wakeUpBuckets["180"] ?? 0,
            wakeUp6h: result.wakeUpBuckets["360"] ?? 0,
            wakeUp24h: result.wakeUpBuckets["1440"] ?? 0,
            chatterDMs1h: result.chatterDMs["60"] ?? 0,
            chatterDMs3h: result.chatterDMs["180"] ?? 0,
            wakeUpComputed: true,
            wakeUpComputedAt: now,
          },
        });

        const b = result.wakeUpBuckets;
        const r = result.reactivationBuckets;
        const totalPurchases = purchases["1440"] || 0;
        console.log(`[WakeUp] ${push.id}: 30m=${b["30"]} 1h=${b["60"]} 3h=${b["180"]} (${result.totalReplied} replied, ${totalPurchases} purchases, reactivated: 3d=${r["3d"]} 7d=${r["7d"]} 15d=${r["15d"]} 30d=${r["30d"]})`);
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
    // First pass: compute any that haven't been computed yet (new items)
    const fresh = await wakeUpRate.triggerAndWait({ limit: 100, recompute: false });
    // Second pass: recompute existing ones to update running totals
    const result = await wakeUpRate.triggerAndWait({ limit: 100, recompute: true });
    return result;
  },
});

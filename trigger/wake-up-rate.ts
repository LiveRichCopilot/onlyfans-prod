/**
 * Wake Up Rate — "How many cold fans started chatting after this post?"
 *
 * For each mass message, counts fans who messaged AFTER it
 * who had NOT chatted in the last 3 days (truly dormant/cold fans).
 *
 * Result: simple count like "12 fans woke up"
 * Not a percentage. Not against sentCount. Just the number of cold fans who replied.
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

// A fan is "dormant" if they haven't chatted (either direction) in this many days
const DORMANT_DAYS = 3;

function clampToNow(d: Date, now: Date) {
  return d.getTime() > now.getTime() ? now : d;
}

async function computeWakeUps(creatorId: string, T0: Date, now: Date) {
  // Dormant = no chat activity in 3 days before the mass message
  const dormantCutoff = new Date(T0.getTime() - DORMANT_DAYS * 24 * 3600_000);

  const w30m = clampToNow(new Date(T0.getTime() + 30 * 60_000), now);
  const w1h = clampToNow(new Date(T0.getTime() + 1 * 3600_000), now);
  const w3h = clampToNow(new Date(T0.getTime() + 3 * 3600_000), now);
  const w6h = clampToNow(new Date(T0.getTime() + 6 * 3600_000), now);
  const w24h = clampToNow(new Date(T0.getTime() + 24 * 3600_000), now);

  // 1) All fans who sent an inbound message after the post (up to 24h)
  const firstInboundByChat = await prisma.rawChatMessage.groupBy({
    by: ["chatId"],
    where: {
      creatorId,
      isFromCreator: false,
      sentAt: { gt: T0, lte: w24h },
    },
    _min: { sentAt: true },
  });

  // 2) Count outbound chatter DMs after the mass message
  const chatterDMs1hCount = await prisma.rawChatMessage.count({
    where: { creatorId, isFromCreator: true, sentAt: { gt: T0, lte: w1h } },
  });
  const chatterDMs3hCount = await prisma.rawChatMessage.count({
    where: { creatorId, isFromCreator: true, sentAt: { gt: T0, lte: w3h } },
  });

  if (firstInboundByChat.length === 0) {
    return {
      totalReplied: 0, dormantWoke: 0,
      wake30m: 0, wake1h: 0, wake3h: 0, wake6h: 0, wake24h: 0,
      chatterDMs1h: chatterDMs1hCount, chatterDMs3h: chatterDMs3hCount,
    };
  }

  const responderChatIds = firstInboundByChat.map((r) => r.chatId);

  // 3) Find which responders had ANY chat activity in the 3 days before the post
  //    (any direction — fan or creator messages both count as "active")
  const activeBeforePost = await prisma.rawChatMessage.groupBy({
    by: ["chatId"],
    where: {
      creatorId,
      chatId: { in: responderChatIds },
      sentAt: { gte: dormantCutoff, lte: T0 },
    },
  });

  const activeSet = new Set(activeBeforePost.map((a) => a.chatId));

  // 4) Dormant wake-ups = responders who had NO activity in last 3 days
  const dormantWakeUps = firstInboundByChat
    .filter((r) => !activeSet.has(r.chatId))
    .map((r) => r._min.sentAt!)
    .filter(Boolean);

  return {
    totalReplied: firstInboundByChat.length,
    dormantWoke: dormantWakeUps.length,
    wake30m: dormantWakeUps.filter((t) => t <= w30m).length,
    wake1h: dormantWakeUps.filter((t) => t <= w1h).length,
    wake3h: dormantWakeUps.filter((t) => t <= w3h).length,
    wake6h: dormantWakeUps.filter((t) => t <= w6h).length,
    wake24h: dormantWakeUps.filter((t) => t <= w24h).length,
    chatterDMs1h: chatterDMs1hCount,
    chatterDMs3h: chatterDMs3hCount,
  };
}

export const wakeUpRate = task({
  id: "wake-up-rate",
  retry: { maxAttempts: 1 },
  run: async (payload: { limit?: number; creatorId?: string; recompute?: boolean }) => {
    const limit = payload.limit || 50;
    const now = new Date();

    // Process posts 15 min to 48h old
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
            // dormantBefore = how many fans were truly dormant (no chat in 3 days)
            // We don't know the exact number without checking all recipients,
            // so we store totalReplied for context
            dormantBefore: result.totalReplied,
            wakeUp30m: result.wake30m,
            wakeUp1h: result.wake1h,
            wakeUp3h: result.wake3h,
            wakeUp6h: result.wake6h,
            wakeUp24h: result.wake24h,
            chatterDMs1h: result.chatterDMs1h,
            chatterDMs3h: result.chatterDMs3h,
            wakeUpComputed: true,
            wakeUpComputedAt: now,
          },
        });

        console.log(`[WakeUp] ${push.id}: ${result.dormantWoke} cold fans woke up (${result.totalReplied} total replied) | chatter DMs: ${result.chatterDMs1h}/${result.chatterDMs3h}`);
        computed++;
      } catch (e: any) {
        console.error(`[WakeUp] ${push.id}: ${e.message}`);
      }
    }

    return { computed, total: pushEvents.length };
  },
});

// Run every 15 minutes for fast feedback
export const wakeUpRateScheduled = schedules.task({
  id: "wake-up-rate-scheduled",
  cron: "*/15 * * * *",
  run: async () => {
    const result = await wakeUpRate.triggerAndWait({ limit: 50, recompute: true });
    return result;
  },
});

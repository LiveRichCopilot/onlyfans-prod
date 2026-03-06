/**
 * Wake Up Rate — "Did this post make people chat?"
 *
 * For each mass message, counts unique fans who started chatting AFTER it,
 * excluding fans already in active conversation (any direction) 10 min before.
 * Uses RawChatMessage.chatId as the stable fan identifier.
 *
 * Also counts outbound chatter DMs sent after the mass message.
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const ACTIVE_LOOKBACK_MIN = 10;

function clampToNow(d: Date, now: Date) {
  return d.getTime() > now.getTime() ? now : d;
}

async function computeWakeUps(creatorId: string, T0: Date, now: Date) {
  const activeStart = new Date(T0.getTime() - ACTIVE_LOOKBACK_MIN * 60_000);

  const w30m = clampToNow(new Date(T0.getTime() + 30 * 60_000), now);
  const w1h = clampToNow(new Date(T0.getTime() + 1 * 3600_000), now);
  const w3h = clampToNow(new Date(T0.getTime() + 3 * 3600_000), now);
  const w6h = clampToNow(new Date(T0.getTime() + 6 * 3600_000), now);
  const w24h = clampToNow(new Date(T0.getTime() + 24 * 3600_000), now);

  // 1) First inbound message per fan (chatId) after the post, up to 24h
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
    where: {
      creatorId,
      isFromCreator: true,
      sentAt: { gt: T0, lte: w1h },
    },
  });
  const chatterDMs3hCount = await prisma.rawChatMessage.count({
    where: {
      creatorId,
      isFromCreator: true,
      sentAt: { gt: T0, lte: w3h },
    },
  });

  if (firstInboundByChat.length === 0) {
    return { wake30m: 0, wake1h: 0, wake3h: 0, wake6h: 0, wake24h: 0, chatterDMs1h: chatterDMs1hCount, chatterDMs3h: chatterDMs3hCount };
  }

  const responderChatIds = firstInboundByChat.map((r) => r.chatId);

  // 3) Exclude fans already active in 10 min before the post (any direction)
  const activeBefore = await prisma.rawChatMessage.groupBy({
    by: ["chatId"],
    where: {
      creatorId,
      chatId: { in: responderChatIds },
      sentAt: { gte: activeStart, lte: T0 },
    },
  });

  const activeSet = new Set(activeBefore.map((a) => a.chatId));

  // 4) Wake-ups = responders minus already-active, counted by first inbound time
  const wakeTimes = firstInboundByChat
    .filter((r) => !activeSet.has(r.chatId))
    .map((r) => r._min.sentAt!)
    .filter(Boolean);

  return {
    wake30m: wakeTimes.filter((t) => t <= w30m).length,
    wake1h: wakeTimes.filter((t) => t <= w1h).length,
    wake3h: wakeTimes.filter((t) => t <= w3h).length,
    wake6h: wakeTimes.filter((t) => t <= w6h).length,
    wake24h: wakeTimes.filter((t) => t <= w24h).length,
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

    // Process posts 15 min to 48h old (reduced from 30 min for faster feedback)
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
            dormantBefore: push.sentCount || 0,
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

        if (result.wake30m > 0 || result.wake1h > 0) {
          console.log(`[WakeUp] ${push.id}: 30m=${result.wake30m} 1h=${result.wake1h} 3h=${result.wake3h} 6h=${result.wake6h} | chatter DMs: ${result.chatterDMs1h}/${result.chatterDMs3h}`);
        }
        computed++;
      } catch (e: any) {
        console.error(`[WakeUp] ${push.id}: ${e.message}`);
      }
    }

    return { computed, total: pushEvents.length };
  },
});

// Run every 15 minutes for faster feedback
export const wakeUpRateScheduled = schedules.task({
  id: "wake-up-rate-scheduled",
  cron: "*/15 * * * *",
  run: async () => {
    const result = await wakeUpRate.triggerAndWait({ limit: 50, recompute: true });
    return result;
  },
});

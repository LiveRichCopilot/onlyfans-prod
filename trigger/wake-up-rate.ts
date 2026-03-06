/**
 * Wake Up Rate Task — "Can a post raise the dead?"
 *
 * For each push event (OutboundCreative), computes:
 * - How many fans were dormant (no INBOUND message in 7+ days) at push time
 * - How many of those dormant fans sent an inbound message within 1h, 3h, 6h, 24h
 *
 * Rules:
 * - Wake-up = INBOUND message only (fan→creator). NOT transactions/purchases.
 * - Dormant = lastInboundAt is null OR < pushTime - 7 days
 * - Excludes new subscribers (subscribedAt > pushTime)
 * - Uses lastInboundAt (inbound-only), NOT lastMessageAt (ambiguous)
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const DORMANT_DAYS = 7;

export const wakeUpRate = task({
  id: "wake-up-rate",
  retry: { maxAttempts: 1 },
  run: async (payload: { limit?: number; creatorId?: string; recompute?: boolean }) => {
    const limit = payload.limit || 50;

    // Compute wake-up for any post at least 30 min old — no 24h wait
    const minAge = new Date(Date.now() - 30 * 60 * 1000);
    const where: any = {
      mediaCount: { gt: 0 },
      sentAt: { lt: minAge },
    };
    if (!payload.recompute) where.wakeUpComputed = false;
    if (payload.creatorId) where.creatorId = payload.creatorId;

    const pushEvents = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
      select: { id: true, creatorId: true, sentAt: true },
    });

    if (pushEvents.length === 0) {
      return { computed: 0, message: "No push events needing wake-up computation" };
    }

    let computed = 0;

    for (const push of pushEvents) {
      try {
        const pushTime = new Date(push.sentAt);
        const dormantCutoff = new Date(pushTime.getTime() - DORMANT_DAYS * 24 * 60 * 60 * 1000);

        // Dormant fans: lastInboundAt is null OR older than 7 days before push
        // Exclude: subscribedAt > pushTime (new subs after the push)
        // Exclude: createdAt > pushTime (fan record didn't exist yet)
        const dormantFans = await prisma.fan.findMany({
          where: {
            creatorId: push.creatorId,
            createdAt: { lt: pushTime },
            OR: [
              { subscribedAt: null },
              { subscribedAt: { lt: pushTime } },
            ],
            AND: {
              OR: [
                { lastInboundAt: null },
                { lastInboundAt: { lt: dormantCutoff } },
              ],
            },
          },
          select: { id: true },
        });

        const dormantCount = dormantFans.length;
        if (dormantCount === 0) {
          await prisma.outboundCreative.update({
            where: { id: push.id },
            data: {
              dormantBefore: 0, wakeUp1h: 0, wakeUp3h: 0, wakeUp6h: 0, wakeUp24h: 0,
              wakeUpComputed: true, wakeUpComputedAt: new Date(),
            },
          });
          computed++;
          continue;
        }

        const dormantIds = dormantFans.map((f) => f.id);

        // Check which dormant fans had an INBOUND message (lastInboundAt moved into window)
        const window1h = new Date(pushTime.getTime() + 1 * 60 * 60 * 1000);
        const window3h = new Date(pushTime.getTime() + 3 * 60 * 60 * 1000);
        const window6h = new Date(pushTime.getTime() + 6 * 60 * 60 * 1000);
        const window24h = new Date(pushTime.getTime() + 24 * 60 * 60 * 1000);

        // Fans whose lastInboundAt is within [pushTime, window]
        // This means they sent a message AFTER the push
        const wake1h = await prisma.fan.count({
          where: { id: { in: dormantIds }, lastInboundAt: { gte: pushTime, lte: window1h } },
        });
        const wake3h = await prisma.fan.count({
          where: { id: { in: dormantIds }, lastInboundAt: { gte: pushTime, lte: window3h } },
        });
        const wake6h = await prisma.fan.count({
          where: { id: { in: dormantIds }, lastInboundAt: { gte: pushTime, lte: window6h } },
        });
        const wake24h = await prisma.fan.count({
          where: { id: { in: dormantIds }, lastInboundAt: { gte: pushTime, lte: window24h } },
        });

        await prisma.outboundCreative.update({
          where: { id: push.id },
          data: {
            dormantBefore: dormantCount,
            wakeUp1h: wake1h,
            wakeUp3h: wake3h,
            wakeUp6h: wake6h,
            wakeUp24h: wake24h,
            wakeUpComputed: true,
            wakeUpComputedAt: new Date(),
          },
        });

        if (wake24h > 0) {
          console.log(
            `[WakeUp] ${push.id}: ${dormantCount} dormant → woke ${wake1h}/${wake3h}/${wake6h}/${wake24h} (1h/3h/6h/24h)`
          );
        }
        computed++;
      } catch (e: any) {
        console.error(`[WakeUp] ${push.id}: ${e.message}`);
      }
    }

    return { computed, total: pushEvents.length };
  },
});

// Run every 30 minutes to keep wake-up data fresh
export const wakeUpRateScheduled = schedules.task({
  id: "wake-up-rate-scheduled",
  cron: "*/30 * * * *",
  run: async () => {
    const result = await wakeUpRate.triggerAndWait({ limit: 50 });
    return result;
  },
});

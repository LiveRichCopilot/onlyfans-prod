/**
 * Buyers Enrichment Task — Transaction-based (source of truth)
 *
 * Mass messages: counts "message" transactions for that creator in a time window.
 * DMs: EXACT match using (creatorId, fanId, amount, window) — fan ID from raw.toUserId.
 *
 * Runs every 15 min via schedule. Two passes:
 *   1) Fresh: PPVs with purchasedCount = null (never computed)
 *   2) Recompute: all recent PPVs to update running totals
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

/**
 * DM PPV: exact attribution via (creatorId, fanId, price match, time window)
 * raw.toUserId → Fan.ofapiFanId → Transaction.fanId
 */
async function countDmPurchase(
  creatorId: string, sentAt: Date, priceCents: number | null, rawToUserId: string | null, now: Date
): Promise<number> {
  if (!rawToUserId) return 0; // Can't attribute without fan ID

  // Find our Fan record for this OF user
  const fan = await prisma.fan.findFirst({
    where: { ofapiFanId: rawToUserId },
    select: { id: true },
  });
  if (!fan) return 0;

  const maxWindow = new Date(Math.min(sentAt.getTime() + 48 * 3600_000, now.getTime()));
  const priceDollars = priceCents ? priceCents / 100 : null;

  // Exact match: same creator, same fan, "message" type, matching price, within window
  if (priceDollars && priceDollars > 0) {
    // Allow small tolerance for rounding (±$0.02)
    const exactMatch = await prisma.transaction.count({
      where: {
        creatorId,
        fanId: fan.id,
        type: { contains: "message" },
        amount: { gte: priceDollars - 0.02, lte: priceDollars + 0.02 },
        date: { gt: sentAt, lte: maxWindow },
      },
    });
    if (exactMatch > 0) return 1; // DM is 1:1, so purchased = 0 or 1
  }

  // Fallback: any "message" purchase from this fan in the window (different price = possible)
  const anyMatch = await prisma.transaction.count({
    where: {
      creatorId,
      fanId: fan.id,
      type: { contains: "message" },
      amount: { gt: 0 },
      date: { gt: sentAt, lte: maxWindow },
    },
  });
  return anyMatch > 0 ? 1 : 0;
}

/**
 * Mass message / wall post: count all "message" transactions in window
 * (one message goes to many fans — aggregate count)
 */
async function countMassPurchases(
  creatorId: string, sentAt: Date, now: Date
): Promise<number> {
  const maxWindow24h = new Date(sentAt.getTime() + 24 * 3600_000);
  const upperBound = maxWindow24h.getTime() > now.getTime() ? now : maxWindow24h;

  // Cap window at next PPV for this creator (avoid double-counting)
  const nextPPV = await prisma.outboundCreative.findFirst({
    where: {
      creatorId, isFree: false, sentAt: { gt: sentAt },
      source: { in: ["mass_message", "wall_post"] },
    },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true },
  });
  const windowEnd = nextPPV
    ? new Date(Math.min(nextPPV.sentAt.getTime(), upperBound.getTime()))
    : upperBound;

  return prisma.transaction.count({
    where: {
      creatorId,
      type: { contains: "message" },
      amount: { gt: 0 },
      date: { gt: sentAt, lte: windowEnd },
    },
  });
}

export const buyersEnrichment = task({
  id: "buyers-enrichment",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number; creatorId?: string; recompute?: boolean }) => {
    const limit = payload.limit || 100;
    const now = new Date();

    const where: any = {
      isFree: false,
      mediaCount: { gt: 0 },
      sentAt: { gt: new Date(now.getTime() - 7 * 24 * 3600_000) },
    };
    if (!payload.recompute) where.purchasedCount = null;
    if (payload.creatorId) where.creatorId = payload.creatorId;

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true, creatorId: true, sentAt: true, source: true,
        priceCents: true, externalId: true, raw: true,
      },
    });

    if (creatives.length === 0) {
      return { enriched: 0, message: "No PPVs needing buyer enrichment" };
    }

    let enriched = 0;
    let errors = 0;
    let dmExact = 0;

    for (const creative of creatives) {
      try {
        let count: number;

        if (creative.source === "direct_message") {
          // Extract fan OF ID from raw JSON
          const rawObj = creative.raw as Record<string, any> | null;
          const toUserId = rawObj?.toUserId ? String(rawObj.toUserId) : null;
          count = await countDmPurchase(
            creative.creatorId, new Date(creative.sentAt),
            creative.priceCents, toUserId, now
          );
          if (count > 0) dmExact++;
        } else {
          count = await countMassPurchases(
            creative.creatorId, new Date(creative.sentAt), now
          );
        }

        await prisma.outboundCreative.update({
          where: { id: creative.id },
          data: { purchasedCount: count },
        });

        if (count > 0) {
          console.log(`[Buyers] ${creative.externalId} (${creative.source}): ${count} purchases`);
        }
        enriched++;
      } catch (e: any) {
        console.error(`[Buyers] ${creative.externalId}: ${e.message}`);
        errors++;
      }
    }

    return { enriched, errors, total: creatives.length, dmExact };
  },
});

export const buyersEnrichmentScheduled = schedules.task({
  id: "buyers-enrichment-scheduled",
  cron: "*/15 * * * *",
  run: async () => {
    await buyersEnrichment.triggerAndWait({ limit: 200, recompute: false });
    const result = await buyersEnrichment.triggerAndWait({ limit: 200, recompute: true });
    return result;
  },
});

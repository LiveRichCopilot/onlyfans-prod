/**
 * Buyers Enrichment Task — Transaction-based (source of truth)
 *
 * Uses the Transaction table to count purchases for PPV OutboundCreatives.
 * For mass messages: counts "message" transactions in 24h window after send.
 * For DMs: matches by creator + fan chat + price + time window.
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

async function countPurchasesForCreative(
  creatorId: string,
  sentAt: Date,
  source: string,
  priceCents: number | null,
  now: Date
): Promise<number> {
  const maxWindow24h = new Date(sentAt.getTime() + 24 * 60 * 60_000);
  const upperBound = maxWindow24h.getTime() > now.getTime() ? now : maxWindow24h;

  if (source === "direct_message") {
    // DM PPV: find the next PPV DM for this creator to cap the window
    const nextPPV = await prisma.outboundCreative.findFirst({
      where: {
        creatorId,
        source: "direct_message",
        isFree: false,
        sentAt: { gt: sentAt },
      },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });
    const windowEnd = nextPPV
      ? new Date(Math.min(nextPPV.sentAt.getTime(), upperBound.getTime()))
      : upperBound;

    // Count "message" transactions for this creator in the window
    const count = await prisma.transaction.count({
      where: {
        creatorId,
        type: { contains: "message" },
        amount: { gt: 0 },
        date: { gt: sentAt, lte: windowEnd },
      },
    });
    return count;
  }

  // Mass message / wall post: same logic as wake-up-rate purchaseBuckets
  const nextPPV = await prisma.outboundCreative.findFirst({
    where: {
      creatorId,
      isFree: false,
      sentAt: { gt: sentAt },
      source: { in: ["mass_message", "wall_post"] },
    },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true },
  });
  const windowEnd = nextPPV
    ? new Date(Math.min(nextPPV.sentAt.getTime(), upperBound.getTime()))
    : upperBound;

  const count = await prisma.transaction.count({
    where: {
      creatorId,
      type: { contains: "message" },
      amount: { gt: 0 },
      date: { gt: sentAt, lte: windowEnd },
    },
  });
  return count;
}

export const buyersEnrichment = task({
  id: "buyers-enrichment",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number; creatorId?: string; recompute?: boolean }) => {
    const limit = payload.limit || 100;
    const now = new Date();

    // Find PPVs to enrich
    const where: any = {
      isFree: false,
      mediaCount: { gt: 0 },
      // Only look at content from last 7 days (transactions are synced with 24h lookback)
      sentAt: { gt: new Date(now.getTime() - 7 * 24 * 60 * 60_000) },
    };
    if (!payload.recompute) {
      where.purchasedCount = null; // Only uncomputed
    }
    if (payload.creatorId) where.creatorId = payload.creatorId;

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
      select: {
        id: true, creatorId: true, sentAt: true, source: true,
        priceCents: true, externalId: true,
      },
    });

    if (creatives.length === 0) {
      return { enriched: 0, message: "No PPVs needing buyer enrichment" };
    }

    let enriched = 0;
    let errors = 0;

    for (const creative of creatives) {
      try {
        const count = await countPurchasesForCreative(
          creative.creatorId,
          new Date(creative.sentAt),
          creative.source,
          creative.priceCents,
          now
        );

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

    return { enriched, errors, total: creatives.length };
  },
});

export const buyersEnrichmentScheduled = schedules.task({
  id: "buyers-enrichment-scheduled",
  cron: "*/15 * * * *",
  run: async () => {
    // First pass: fresh PPVs with no purchasedCount
    await buyersEnrichment.triggerAndWait({ limit: 200, recompute: false });
    // Second pass: recompute recent to update running totals
    const result = await buyersEnrichment.triggerAndWait({ limit: 200, recompute: true });
    return result;
  },
});

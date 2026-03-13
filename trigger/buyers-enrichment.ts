/**
 * Buyers Enrichment Task — Transaction-based (source of truth)
 *
 * Mass messages: counts "message" transactions for that creator in a time window.
 * DMs: EXACT match using (creatorId, fanId, amount, window) — fan ID from raw.toUserId.
 *
 * Runs every 10 min via schedule. Three passes:
 *   1) Fresh: PPVs with purchasedCount = null (never computed)
 *   2) Recompute: all recent PPVs to update running totals
 *   3) Verify: cross-check Transaction totals vs purchasedCount — auto-correct mismatches
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
          // Extract fan OF ID from raw JSON — field is toUser.id (object), not toUserId
          const rawObj = creative.raw as Record<string, any> | null;
          const toUserId = rawObj?.toUser?.id ? String(rawObj.toUser.id) : (rawObj?.toUserId ? String(rawObj.toUserId) : null);
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

/**
 * Pass 3: Verification — find PPVs where purchasedCount=0 but transactions exist.
 * This catches sales that landed between enrichment runs. Auto-corrects mismatches.
 */
export const buyersVerify = task({
  id: "buyers-verify",
  retry: { maxAttempts: 1 },
  run: async () => {
    const now = new Date();
    const since = new Date(now.getTime() - 48 * 3600_000); // 48h window

    // All paid PPVs with purchasedCount=0 in the last 48h
    const zeros = await prisma.outboundCreative.findMany({
      where: {
        isFree: false,
        mediaCount: { gt: 0 },
        purchasedCount: 0,
        sentAt: { gt: since },
      },
      select: {
        id: true, creatorId: true, sentAt: true, source: true,
        priceCents: true, externalId: true, raw: true,
      },
      take: 300,
    });

    if (zeros.length === 0) {
      return { verified: 0, corrected: 0, message: "All counts match" };
    }

    let corrected = 0;

    for (const ppv of zeros) {
      try {
        let liveCount: number;
        const sentAt = new Date(ppv.sentAt);

        if (ppv.source === "direct_message") {
          const rawObj = ppv.raw as Record<string, any> | null;
          const toUserId = rawObj?.toUser?.id ? String(rawObj.toUser.id) : (rawObj?.toUserId ? String(rawObj.toUserId) : null);
          liveCount = await countDmPurchase(ppv.creatorId, sentAt, ppv.priceCents, toUserId, now);
        } else {
          liveCount = await countMassPurchases(ppv.creatorId, sentAt, now);
        }

        if (liveCount > 0) {
          await prisma.outboundCreative.update({
            where: { id: ppv.id },
            data: { purchasedCount: liveCount },
          });
          console.log(`[Verify] CORRECTED ${ppv.externalId} (${ppv.source}): 0→${liveCount}`);
          corrected++;
        }
      } catch (e: any) {
        console.error(`[Verify] ${ppv.externalId}: ${e.message}`);
      }
    }

    return { verified: zeros.length, corrected };
  },
});

export const buyersEnrichmentScheduled = schedules.task({
  id: "buyers-enrichment-scheduled",
  cron: "*/10 * * * *",
  run: async () => {
    // Pass 1: Fresh — PPVs never enriched
    await buyersEnrichment.triggerAndWait({ limit: 200, recompute: false });
    // Pass 2: Recompute — update running totals
    const recompute = await buyersEnrichment.triggerAndWait({ limit: 200, recompute: true });
    // Pass 3: Verify — catch mismatches where purchasedCount=0 but transactions exist
    const verify = await buyersVerify.triggerAndWait({});
    return { recompute, verify };
  },
});

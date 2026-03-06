/**
 * Buyers Enrichment Task
 *
 * Calls GET /api/{account}/engagement/messages/{message_id}/buyers
 * for each PPV OutboundCreative missing purchasedCount.
 * Updates purchasedCount on the row.
 */
import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});
const OFAPI_BASE = "https://app.onlyfansapi.com";

export const buyersEnrichment = task({
  id: "buyers-enrichment",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number; creatorId?: string }) => {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) throw new Error("OFAPI_API_KEY not set");

    // Find PPVs without purchasedCount
    const where: any = {
      isFree: false,
      purchasedCount: null,
      mediaCount: { gt: 0 },
    };
    if (payload.creatorId) where.creatorId = payload.creatorId;

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: payload.limit || 20,
      select: {
        id: true, externalId: true, creatorId: true,
      },
    });

    if (creatives.length === 0) {
      return { enriched: 0, message: "No PPVs needing buyer enrichment" };
    }

    // Get creator account IDs
    const creatorIds = [...new Set(creatives.map((c) => c.creatorId))];
    const creators = await prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, ofapiCreatorId: true },
    });
    const creatorAcctMap = new Map(creators.map((c) => [c.id, c.ofapiCreatorId]));

    let enriched = 0;
    let errors = 0;

    for (const creative of creatives) {
      const acctId = creatorAcctMap.get(creative.creatorId);
      if (!acctId) continue;

      try {
        const url = `${OFAPI_BASE}/api/${acctId}/engagement/messages/${creative.externalId}/buyers`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          // 404 = no buyers endpoint for this message type, set to 0
          if (res.status === 404) {
            await prisma.outboundCreative.update({
              where: { id: creative.id },
              data: { purchasedCount: 0 },
            });
            enriched++;
          } else {
            console.error(`[Buyers] ${creative.externalId}: ${res.status}`);
            errors++;
          }
          continue;
        }

        const data = await res.json();
        // Buyers response: data.list or data array
        const buyers = data?.data?.list ?? data?.data ?? [];
        const count = Array.isArray(buyers) ? buyers.length : 0;

        await prisma.outboundCreative.update({
          where: { id: creative.id },
          data: { purchasedCount: count },
        });
        enriched++;

        console.log(`[Buyers] ${creative.externalId}: ${count} buyers`);

        // Rate limit: small delay between calls
        await new Promise((r) => setTimeout(r, 200));
      } catch (e: any) {
        console.error(`[Buyers] ${creative.externalId}: ${e.message}`);
        errors++;
      }
    }

    return { enriched, errors, total: creatives.length };
  },
});

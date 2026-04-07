/**
 * Sora live refresh — pulls the freshest mass message data from OFAPI
 * for a single model and writes it into OutboundCreative.
 *
 * Called on every Sora price-points fetch for the selected model so
 * numbers always match what OF's Statistics → Engagement page shows
 * right now, not whatever stale values the background crons have.
 *
 * Uses getAllMassMessageStats (paginated) from lib/ofapi-engagement.ts
 * which walks OFAPI's /engagement/messages/mass-messages endpoint. The
 * `purchasedCount` field in that response IS what OF's UI displays.
 */

import { prisma } from "@/lib/prisma";
import { getAllMassMessageStats } from "@/lib/ofapi-engagement";

export async function refreshModelMassMessages(args: {
  creatorId: string;
  ofapiCreatorId: string;
  days: number;
}): Promise<{ refreshed: number; errors: number }> {
  const apiKey = (process.env.OFAPI_API_KEY || "").trim();
  if (!apiKey) return { refreshed: 0, errors: 1 };

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - args.days * 86400000);

  let messages: any[];
  try {
    messages = await getAllMassMessageStats(
      args.ofapiCreatorId,
      apiKey,
      { startDate, endDate },
      { maxPages: 10 },
    );
  } catch {
    return { refreshed: 0, errors: 1 };
  }

  let refreshed = 0;
  let errors = 0;

  for (const m of messages) {
    try {
      const externalId = String(m.id || "");
      if (!externalId) continue;

      let priceCents: number | null = null;
      if (m.price != null) {
        const p = typeof m.price === "string" ? parseFloat(m.price) : Number(m.price);
        if (!isNaN(p) && p > 0) priceCents = Math.round(p * 100);
      }

      // Trust the list response's purchasedCount — this is what OF shows.
      // For free masses, OFAPI returns null/0.
      let purchasedCount: number | null = null;
      if (m.purchasedCount != null) {
        const pc = typeof m.purchasedCount === "string" ? parseInt(m.purchasedCount, 10) : Number(m.purchasedCount);
        if (!isNaN(pc)) purchasedCount = pc;
      }

      await prisma.outboundCreative.upsert({
        where: {
          creatorId_source_externalId: {
            creatorId: args.creatorId,
            source: "mass_message",
            externalId,
          },
        },
        create: {
          creatorId: args.creatorId,
          externalId,
          source: "mass_message",
          sentAt: m.date ? new Date(m.date) : endDate,
          textHtml: m.text ?? null,
          textPlain: m.rawText ?? m.text ?? null,
          isFree: m.isFree !== false,
          priceCents,
          purchasedCount,
          mediaCount: m.mediaCount ?? 0,
          sentCount: m.sentCount ?? 0,
          viewedCount: m.viewedCount ?? 0,
          isCanceled: m.isCanceled === true,
          canUnsend: m.canUnsend === true,
          raw: m,
        },
        update: {
          sentAt: m.date ? new Date(m.date) : endDate,
          priceCents,
          purchasedCount,
          mediaCount: m.mediaCount ?? 0,
          sentCount: m.sentCount ?? 0,
          viewedCount: m.viewedCount ?? 0,
          isCanceled: m.isCanceled === true,
          raw: m,
        },
      });

      refreshed++;
    } catch {
      errors++;
    }
  }

  return { refreshed, errors };
}

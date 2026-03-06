import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllDirectMessageStats } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/sync-dm-content
 * Separate cron for DM sync — doesn't compete with mass message sync for time.
 * Syncs chatter DMs with media across ALL creators.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const creators = await prisma.creator.findMany({
      where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
      select: { id: true, name: true, ofapiCreatorId: true },
    });

    const apiKey = process.env.OFAPI_API_KEY || "";
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let totalUpserted = 0;

    for (const creator of creators) {
      const acctId = creator.ofapiCreatorId!;

      try {
        const dms = await getAllDirectMessageStats(acctId, apiKey, {
          startDate,
          endDate: now,
        });

        for (const m of dms) {
          if (!m.mediaCount && (!m.media || m.media.length === 0)) continue;

          const externalId = String(m.id || "");
          if (!externalId) continue;

          let priceCents: number | null = null;
          if (m.price != null) {
            const p = typeof m.price === "string" ? parseFloat(m.price) : Number(m.price);
            if (!isNaN(p) && p > 0) priceCents = Math.round(p * 100);
          }

          let purchasedCount: number | null = null;
          if (m.purchasedCount != null) {
            const pc = typeof m.purchasedCount === "string" ? parseInt(m.purchasedCount) : Number(m.purchasedCount);
            if (!isNaN(pc)) purchasedCount = pc;
          }

          await prisma.outboundCreative.upsert({
            where: {
              creatorId_source_externalId: {
                creatorId: creator.id,
                source: "direct_message",
                externalId,
              },
            },
            create: {
              creatorId: creator.id,
              externalId,
              source: "direct_message",
              sentAt: m.date ? new Date(m.date) : now,
              textHtml: m.text ?? null,
              textPlain: m.rawText ?? m.text ?? null,
              isFree: m.isFree !== false,
              priceCents,
              purchasedCount,
              mediaCount: m.mediaCount ?? m.media?.length ?? 0,
              sentCount: 1,
              viewedCount: m.isOpened ? 1 : 0,
              isCanceled: false,
              canUnsend: false,
              raw: m,
            },
            update: {
              priceCents,
              purchasedCount,
              viewedCount: m.isOpened ? 1 : 0,
              raw: m,
            },
          });
          totalUpserted++;
        }
      } catch (e: any) {
        console.error(`[sync-dm] ${creator.name}:`, e.message);
      }
    }

    return NextResponse.json({ ok: true, upserted: totalUpserted, creators: creators.length });
  } catch (err: any) {
    console.error("[sync-dm]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

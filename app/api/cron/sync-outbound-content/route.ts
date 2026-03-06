import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllMassMessageStats, getAllDirectMessageStats } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/sync-outbound-content
 * Syncs mass messages AND chatter DMs (with media) from OFAPI.
 * 24h lookback + dedup via @@unique([creatorId, source, externalId]).
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const creators = await prisma.creator.findMany({
      where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
      select: { id: true, ofapiCreatorId: true },
    });

    const apiKey = process.env.OFAPI_API_KEY || "";
    const now = new Date();
    const daysBack = parseInt(searchParams?.get("days") || "1");
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    let totalUpserted = 0;
    let totalMedia = 0;

    for (const creator of creators) {
      const acctId = creator.ofapiCreatorId!;

      try {
        const messages = await getAllMassMessageStats(acctId, apiKey, {
          startDate,
          endDate: now,
        });

        for (const m of messages) {
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

          const shared = {
            sentAt: m.date ? new Date(m.date) : now,
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
          };

          const row = await prisma.outboundCreative.upsert({
            where: {
              creatorId_source_externalId: {
                creatorId: creator.id,
                source: "mass_message",
                externalId,
              },
            },
            create: {
              creatorId: creator.id,
              externalId,
              source: "mass_message",
              ...shared,
            },
            update: {
              sentAt: shared.sentAt,
              textHtml: shared.textHtml,
              textPlain: shared.textPlain,
              isFree: shared.isFree,
              priceCents: shared.priceCents,
              purchasedCount: shared.purchasedCount,
              mediaCount: shared.mediaCount,
              sentCount: shared.sentCount,
              viewedCount: shared.viewedCount,
              isCanceled: shared.isCanceled,
              canUnsend: shared.canUnsend,
              raw: shared.raw,
            },
          });
          totalUpserted++;

          totalMedia += await syncMedia(row.id, m);
        }
      } catch (e: any) {
        console.error(`[sync-outbound] mass ${acctId}:`, e.message);
      }

      // Chatter DMs with media
      try {
        const dms = await getAllDirectMessageStats(acctId, apiKey, {
          startDate,
          endDate: now,
        });

        for (const m of dms) {
          // Only sync DMs that have media
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

          const shared = {
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
          };

          const row = await prisma.outboundCreative.upsert({
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
              ...shared,
            },
            update: {
              ...shared,
            },
          });
          totalUpserted++;

          totalMedia += await syncMedia(row.id, m);
        }
      } catch (e: any) {
        console.error(`[sync-outbound] dm ${acctId}:`, e.message);
      }
    }

    return NextResponse.json({ ok: true, upserted: totalUpserted, media: totalMedia });
  } catch (err: any) {
    console.error("[sync-outbound]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function syncMedia(creativeId: string, item: any): Promise<number> {
  if (!Array.isArray(item.media) || item.media.length === 0) return 0;

  // Only delete+recreate when API returns non-empty media array
  await prisma.outboundMedia.deleteMany({ where: { creativeId } });

  let created = 0;
  for (const m of item.media) {
    const f = m?.files;
    if (!f) continue;
    const fullUrl = f?.full?.url ?? null;
    const previewUrl = f?.preview?.url ?? null;
    const thumbUrl = f?.thumb?.url ?? null;
    if (!fullUrl && !previewUrl && !thumbUrl) continue;

    await prisma.outboundMedia.create({
      data: {
        creativeId,
        mediaType: m.type || "photo",
        fullUrl,
        previewUrl,
        thumbUrl,
        duration: m.duration ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
      },
    });
    created++;
  }
  return created;
}

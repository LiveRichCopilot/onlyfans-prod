import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/backfill-dm-media
 * Recovers missing OutboundMedia records for DMs by extracting media data
 * from RawChatMessage.raw JSON where the webhook failed to link them.
 *
 * Root cause: webhook used shared media IDs (`wh_{mediaId}`) causing
 * only the first DM per media to get an OutboundMedia record.
 *
 * Batch size controlled by ?limit= (default 500, max 2000).
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const limit = Math.min(
      parseInt(new URL(req.url).searchParams.get("limit") || "500"),
      2000,
    );

    // Find DM OutboundCreatives with mediaCount > 0 but no OutboundMedia records
    const orphaned = await prisma.$queryRaw<
      Array<{
        id: string;
        externalId: string;
        creatorId: string;
        mediaCount: number;
      }>
    >`
      SELECT oc.id, oc."externalId", oc."creatorId", oc."mediaCount"
      FROM "OutboundCreative" oc
      WHERE oc.source = 'direct_message'
        AND oc."mediaCount" > 0
        AND NOT EXISTS (SELECT 1 FROM "OutboundMedia" om WHERE om."creativeId" = oc.id)
      ORDER BY oc."sentAt" DESC
      LIMIT ${limit}
    `;

    if (orphaned.length === 0) {
      return NextResponse.json({ ok: true, recovered: 0, message: "No orphaned DMs" });
    }

    let recovered = 0;
    let skipped = 0;

    for (const oc of orphaned) {
      try {
        // Find matching RawChatMessage with media data
        const rcm = await prisma.rawChatMessage.findFirst({
          where: {
            creatorId: oc.creatorId,
            ofMessageId: oc.externalId,
          },
          select: { raw: true },
        });

        if (!rcm?.raw) {
          skipped++;
          continue;
        }

        const raw = rcm.raw as any;
        const media = raw?.media;
        if (!Array.isArray(media) || media.length === 0) {
          skipped++;
          continue;
        }

        let created = 0;
        for (const m of media) {
          const files = m?.files;
          if (!files) continue;

          const fullUrl = files?.full?.url ?? null;
          const previewUrl = files?.preview?.url ?? null;
          const thumbUrl = files?.thumb?.url ?? null;
          if (!fullUrl && !previewUrl && !thumbUrl) continue;

          await prisma.outboundMedia.create({
            data: {
              creativeId: oc.id,
              onlyfansMediaId: m.id ? String(m.id) : null,
              mediaType: m.type || "photo",
              fullUrl,
              previewUrl,
              thumbUrl,
              persistStatus: "pending",
            },
          });
          created++;
        }

        if (created > 0) recovered++;
        else skipped++;
      } catch (e: any) {
        // Skip duplicates or errors
        if (e.code !== "P2002") {
          console.error(`[backfill-dm-media] ${oc.id}:`, e.message);
        }
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      recovered,
      skipped,
      total: orphaned.length,
      message: `Recovered media for ${recovered} DMs, skipped ${skipped}`,
    });
  } catch (err: any) {
    console.error("[backfill-dm-media]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllDirectMessageStats } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OFAPI_BASE = "https://app.onlyfansapi.com";
const MEDIA_BUCKET = "content-media";

async function persistImage(accountId: string, creatorId: string, creativeId: string, sourceUrl: string, mediaId: string): Promise<string | null> {
  const apiKey = (process.env.OFAPI_API_KEY || "").trim();
  if (!apiKey || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(`${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const blob = await res.arrayBuffer();
    const path = `${creatorId}/${creativeId}/${mediaId}.jpg`;
    const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!upRes.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  } catch { return null; }
}

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

          // Persist media to Supabase immediately
          if (Array.isArray(m.media) && m.media.length > 0) {
            const existing = await prisma.outboundMedia.findFirst({ where: { creativeId: row.id, permanentUrl: { not: null } } });
            if (!existing) {
              for (const mi of m.media) {
                const f = mi?.files;
                if (!f) continue;
                const srcUrl = f?.preview?.url || f?.thumb?.url || f?.full?.url;
                if (!srcUrl || mi.type === "video") continue;
                const permUrl = await persistImage(acctId, creator.id, row.id, srcUrl, String(mi.id || `dm${Date.now()}`));
                await prisma.outboundMedia.create({
                  data: {
                    creativeId: row.id,
                    mediaType: mi.type || "photo",
                    fullUrl: f?.full?.url || null,
                    previewUrl: f?.preview?.url || null,
                    thumbUrl: f?.thumb?.url || null,
                    permanentUrl: permUrl,
                  },
                });
              }
            }
          }
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

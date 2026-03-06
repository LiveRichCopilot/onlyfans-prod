import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllMassMessageStats, getAllDirectMessageStats } from "@/lib/ofapi-engagement";
import { ofapiRequest } from "@/lib/ofapi-core";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OFAPI_BASE = "https://app.onlyfansapi.com";
const MEDIA_BUCKET = "content-media";

async function downloadAndPersist(accountId: string, creatorId: string, creativeId: string, sourceUrl: string, mediaId: string, contentType?: string): Promise<string | null> {
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
        "Content-Type": res.headers.get("content-type") || contentType || "image/jpeg",
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!upRes.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  } catch { return null; }
}

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

          totalMedia += await syncMedia(row.id, creator.id, acctId, m);
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

          totalMedia += await syncMedia(row.id, creator.id, acctId, m);
        }
      } catch (e: any) {
        console.error(`[sync-outbound] dm ${acctId}:`, e.message);
      }

      // Wall posts
      try {
        const minDate = startDate.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
        let offset = 0;
        let hasMore = true;
        while (hasMore && offset < 200) {
          const res = await ofapiRequest(
            `/api/${acctId}/posts?minimumPublishDate=${encodeURIComponent(minDate)}&limit=50&offset=${offset}&counters=true&order=publish_date&sort=desc`,
            apiKey, { timeoutMs: 15000 },
          );
          const posts = res?.data?.list ?? res?.data ?? (Array.isArray(res) ? res : []);
          if (!Array.isArray(posts) || posts.length === 0) break;

          for (const p of posts) {
            const externalId = String(p.id || "");
            if (!externalId) continue;

            let priceCents: number | null = null;
            if (p.price != null) {
              const pr = typeof p.price === "string" ? parseFloat(p.price) : Number(p.price);
              if (!isNaN(pr) && pr > 0) priceCents = Math.round(pr * 100);
            }

            const shared = {
              sentAt: p.postedAt || p.publishedAt || p.createdAt ? new Date(p.postedAt || p.publishedAt || p.createdAt) : now,
              textHtml: p.text ?? null,
              textPlain: p.rawText ?? p.text ?? null,
              isFree: priceCents == null || priceCents === 0,
              priceCents,
              purchasedCount: null,
              mediaCount: p.mediaCount ?? p.media?.length ?? 0,
              sentCount: p.counters?.subscribesCount ?? p.counters?.likesCount ?? 0,
              viewedCount: p.counters?.viewsCount ?? 0,
              isCanceled: false,
              canUnsend: false,
              raw: p,
            };

            const row = await prisma.outboundCreative.upsert({
              where: {
                creatorId_source_externalId: {
                  creatorId: creator.id,
                  source: "wall_post",
                  externalId,
                },
              },
              create: { creatorId: creator.id, externalId, source: "wall_post", ...shared },
              update: { ...shared },
            });
            totalUpserted++;
            totalMedia += await syncMedia(row.id, creator.id, acctId, p);
          }

          offset += posts.length;
          hasMore = posts.length === 50;
        }
      } catch (e: any) {
        console.error(`[sync-outbound] posts ${acctId}:`, e.message);
      }
    }

    // Fire media persistence in background (Trigger.dev handles Supabase uploads)
    if (totalMedia > 0) {
      try {
        const triggerUrl = "https://api.trigger.dev/api/v1/tasks/media-persistence/trigger";
        const triggerKey = process.env.TRIGGER_SECRET_KEY || "";
        if (triggerKey) {
          fetch(triggerUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${triggerKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ payload: { limit: Math.min(totalMedia * 2, 200) } }),
          }).catch(() => {}); // fire and forget
        }
      } catch {}
    }

    return NextResponse.json({ ok: true, upserted: totalUpserted, media: totalMedia });
  } catch (err: any) {
    console.error("[sync-outbound]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function syncMedia(creativeId: string, creatorId: string, accountId: string, item: any): Promise<number> {
  if (!Array.isArray(item.media) || item.media.length === 0) return 0;

  // Check if we already have persisted media — don't wipe permanentUrls
  const existing = await prisma.outboundMedia.findMany({
    where: { creativeId },
    select: { id: true, permanentUrl: true },
  });
  const hasPersisted = existing.some((m) => m.permanentUrl);

  if (hasPersisted) {
    // Update CDN URLs on existing records, keep permanentUrls
    for (const m of item.media) {
      const f = m?.files;
      if (!f) continue;
      const fullUrl = f?.full?.url ?? null;
      const previewUrl = f?.preview?.url ?? null;
      const thumbUrl = f?.thumb?.url ?? null;
      if (!fullUrl && !previewUrl && !thumbUrl) continue;
      const match = existing.shift();
      if (match) {
        await prisma.outboundMedia.update({
          where: { id: match.id },
          data: { fullUrl, previewUrl, thumbUrl },
        });
      }
    }
    return 0;
  }

  // No persisted media — create records AND download to Supabase immediately
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

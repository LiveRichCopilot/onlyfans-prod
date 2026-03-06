/**
 * Content Sync Pipeline — runs entirely in Trigger.dev
 *
 * Polls OFAPI for mass messages + DMs → upserts DB → persists media to Supabase
 * All in one task, no handoffs, no expiring URLs. Media is downloaded while fresh.
 *
 * Scheduled every 10 minutes. Processes all 27+ creators per run.
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const OFAPI_BASE = "https://app.onlyfansapi.com";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MEDIA_BUCKET = "content-media";

// ── OFAPI helpers ──

async function ofapiFetch(path: string, apiKey: string) {
  const url = path.startsWith("http") ? path : `${OFAPI_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OFAPI ${res.status}: ${path.slice(0, 80)}`);
  return res.json();
}

function fmtDate(d: Date) { return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, ""); }

async function fetchAllPages(path: string, apiKey: string, maxPages = 20) {
  const all: any[] = [];
  let p: string | undefined = path;
  let pages = 0;
  while (p && pages < maxPages) {
    const raw = await ofapiFetch(p, apiKey);
    const items = raw?.data?.items ?? [];
    all.push(...items);
    pages++;
    p = raw?.data?.hasMore && raw?._pagination?.next_page ? raw._pagination.next_page : undefined;
  }
  return all;
}

// ── Media persistence ──

async function persistToSupabase(accountId: string, creatorId: string, creativeId: string, sourceUrl: string, mediaId: string, apiKey: string): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const dlUrl = `${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`;
    const res = await fetch(dlUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
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

async function syncMediaForCreative(accountId: string, creatorId: string, creativeId: string, mediaItems: any[], apiKey: string): Promise<number> {
  if (!mediaItems || mediaItems.length === 0) return 0;

  // Skip if already persisted
  const existing = await prisma.outboundMedia.findFirst({
    where: { creativeId, permanentUrl: { not: null } },
  });
  if (existing) return 0;

  // Check if media records exist at all
  const count = await prisma.outboundMedia.count({ where: { creativeId } });
  if (count === 0) {
    // Create records + persist immediately
    let saved = 0;
    for (const m of mediaItems) {
      const f = m?.files;
      if (!f) continue;
      const fullUrl = f?.full?.url ?? null;
      const previewUrl = f?.preview?.url ?? null;
      const thumbUrl = f?.thumb?.url ?? null;
      if (!fullUrl && !previewUrl && !thumbUrl) continue;

      // Download to Supabase while URL is fresh
      const sourceUrl = m.type === "video" ? (thumbUrl || previewUrl) : (previewUrl || thumbUrl || fullUrl);
      let permanentUrl: string | null = null;
      if (sourceUrl) {
        permanentUrl = await persistToSupabase(accountId, creatorId, creativeId, sourceUrl, String(m.id || `m${saved}`), apiKey);
      }

      await prisma.outboundMedia.create({
        data: {
          creativeId,
          mediaType: m.type || "photo",
          fullUrl, previewUrl, thumbUrl, permanentUrl,
        },
      });
      saved++;
    }
    return saved;
  } else {
    // Records exist but no permanentUrl — update with persistence
    const records = await prisma.outboundMedia.findMany({
      where: { creativeId, permanentUrl: null },
      select: { id: true, previewUrl: true, thumbUrl: true, fullUrl: true, mediaType: true },
    });
    let saved = 0;
    for (const rec of records) {
      const sourceUrl = rec.mediaType === "video"
        ? (rec.thumbUrl || rec.previewUrl)
        : (rec.previewUrl || rec.thumbUrl || rec.fullUrl);
      if (!sourceUrl) continue;
      const permanentUrl = await persistToSupabase(accountId, creatorId, creativeId, sourceUrl, rec.id, apiKey);
      if (permanentUrl) {
        await prisma.outboundMedia.update({ where: { id: rec.id }, data: { permanentUrl } });
        saved++;
      }
    }
    return saved;
  }
}

// ── Main sync task ──

export const syncContent = task({
  id: "sync-content",
  retry: { maxAttempts: 1 },
  machine: "small-2x",
  run: async (payload: { creatorId?: string; daysBack?: number }) => {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return { error: "No OFAPI_API_KEY" };

    const now = new Date();
    const daysBack = payload.daysBack || 1;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const s = encodeURIComponent(fmtDate(startDate));
    const e = encodeURIComponent(fmtDate(now));

    const where: any = { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } };
    if (payload.creatorId) where.id = payload.creatorId;
    const creators = await prisma.creator.findMany({ where, select: { id: true, name: true, ofapiCreatorId: true } });

    let totalUpserted = 0;
    let totalMedia = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      const acctId = creator.ofapiCreatorId!;

      // ── Mass Messages ──
      try {
        const messages = await fetchAllPages(
          `/api/${acctId}/engagement/messages/mass-messages?startDate=${s}&endDate=${e}&limit=50`, apiKey
        );

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

          const row = await prisma.outboundCreative.upsert({
            where: { creatorId_source_externalId: { creatorId: creator.id, source: "mass_message", externalId } },
            create: {
              creatorId: creator.id, externalId, source: "mass_message",
              sentAt: m.date ? new Date(m.date) : now,
              textHtml: m.text ?? null, textPlain: m.rawText ?? m.text ?? null,
              isFree: m.isFree !== false, priceCents, purchasedCount,
              mediaCount: m.mediaCount ?? 0, sentCount: m.sentCount ?? 0, viewedCount: m.viewedCount ?? 0,
              isCanceled: m.isCanceled === true, canUnsend: m.canUnsend === true, raw: m,
            },
            update: {
              sentAt: m.date ? new Date(m.date) : now,
              textHtml: m.text ?? null, textPlain: m.rawText ?? m.text ?? null,
              isFree: m.isFree !== false, priceCents, purchasedCount,
              mediaCount: m.mediaCount ?? 0, sentCount: m.sentCount ?? 0, viewedCount: m.viewedCount ?? 0,
              isCanceled: m.isCanceled === true, canUnsend: m.canUnsend === true, raw: m,
            },
          });
          totalUpserted++;

          // Persist media immediately while CDN URLs are fresh
          if (Array.isArray(m.media) && m.media.length > 0) {
            totalMedia += await syncMediaForCreative(acctId, creator.id, row.id, m.media, apiKey);
          }
        }
        console.log(`[sync] ${creator.name}: ${messages.length} mass msgs`);
      } catch (err: any) {
        errors.push(`mass ${creator.name}: ${err.message}`);
      }

      // ── DMs with media ──
      try {
        const dms = await fetchAllPages(
          `/api/${acctId}/engagement/messages/direct-messages?startDate=${s}&endDate=${e}&limit=50`, apiKey
        );

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
            where: { creatorId_source_externalId: { creatorId: creator.id, source: "direct_message", externalId } },
            create: {
              creatorId: creator.id, externalId, source: "direct_message",
              sentAt: m.date ? new Date(m.date) : now,
              textHtml: m.text ?? null, textPlain: m.rawText ?? m.text ?? null,
              isFree: m.isFree !== false, priceCents, purchasedCount,
              mediaCount: m.mediaCount ?? m.media?.length ?? 0,
              sentCount: 1, viewedCount: m.isOpened ? 1 : 0,
              isCanceled: false, canUnsend: false, raw: m,
            },
            update: { priceCents, purchasedCount, viewedCount: m.isOpened ? 1 : 0, raw: m },
          });
          totalUpserted++;

          if (Array.isArray(m.media) && m.media.length > 0) {
            totalMedia += await syncMediaForCreative(acctId, creator.id, row.id, m.media, apiKey);
          }
        }
        console.log(`[sync] ${creator.name}: ${dms.length} DMs`);
      } catch (err: any) {
        errors.push(`dm ${creator.name}: ${err.message}`);
      }

      // ── Wall Posts ──
      try {
        const postsRaw = await ofapiFetch(`/api/${acctId}/posts?limit=50&skip_users=all`, apiKey);
        const posts = postsRaw?.data?.list || postsRaw?.list || [];
        for (const p of posts) {
          const postDate = p.postedAt || p.createdAt;
          if (postDate && new Date(postDate) < startDate) continue;
          const externalId = String(p.id || "");
          if (!externalId) continue;

          const row = await prisma.outboundCreative.upsert({
            where: { creatorId_source_externalId: { creatorId: creator.id, source: "wall_post", externalId } },
            create: {
              creatorId: creator.id, externalId, source: "wall_post",
              sentAt: postDate ? new Date(postDate) : now,
              textHtml: p.text ?? null, textPlain: p.rawText ?? p.text ?? null,
              isFree: p.isFree !== false,
              priceCents: p.price ? Math.round(Number(p.price) * 100) : null,
              mediaCount: p.mediaCount ?? p.media?.length ?? 0,
              sentCount: p.favoritesCount ?? 0, viewedCount: p.viewsCount ?? 0,
              isCanceled: false, canUnsend: false, raw: p,
            },
            update: {
              sentCount: p.favoritesCount ?? 0, viewedCount: p.viewsCount ?? 0, raw: p,
            },
          });
          totalUpserted++;

          if (Array.isArray(p.media) && p.media.length > 0) {
            totalMedia += await syncMediaForCreative(acctId, creator.id, row.id, p.media, apiKey);
          }
        }
        console.log(`[sync] ${creator.name}: ${posts.length} wall posts`);
      } catch (err: any) {
        errors.push(`posts ${creator.name}: ${err.message}`);
      }
    }

    return { upserted: totalUpserted, media: totalMedia, creators: creators.length, errors };
  },
});

// Run every 10 minutes
export const syncContentScheduled = schedules.task({
  id: "sync-content-scheduled",
  cron: "*/10 * * * *",
  run: async () => {
    const result = await syncContent.triggerAndWait({});
    return result;
  },
});

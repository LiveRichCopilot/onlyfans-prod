/**
 * Content Sync Pipeline — Trigger.dev (no Vercel timeout)
 * Stage 1: POLL OFAPI → upsert DB (fast)
 * Stage 2: PERSIST media → vault fresh URL → download → Supabase upload
 * Pattern A: GET /api/{account}/media/vault/{media_id} for fresh URLs
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

// ── Stage 2: Media persistence (Pattern A — fresh URL from vault) ──

async function getFreshMediaUrl(accountId: string, mediaId: string, apiKey: string): Promise<{ preview?: string; thumb?: string; full?: string } | null> {
  try {
    const res = await ofapiFetch(`/api/${accountId}/media/vault/${mediaId}`, apiKey);
    const files = res?.data?.files || res?.files;
    if (!files) return null;
    return {
      preview: files?.preview?.url,
      thumb: files?.thumb?.url,
      full: files?.full?.url,
    };
  } catch {
    return null;
  }
}

async function uploadToSupabase(creatorId: string, creativeId: string, mediaId: string, sourceUrl: string, apiKey: string, accountId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    // Download via OFAPI (handles auth + IP restrictions)
    const dlUrl = `${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`;
    const res = await fetch(dlUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
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

async function persistMediaBatch(accountId: string, creatorId: string, mediaRows: any[], apiKey: string): Promise<{ ok: number; failed: number }> {
  let ok = 0, failed = 0;
  for (let i = 0; i < mediaRows.length; i += 3) {
    const batch = mediaRows.slice(i, i + 3);
    const results = await Promise.allSettled(batch.map(async (row: any) => {
      if (!row.onlyfansMediaId) return false;
      // Get fresh URL from vault, fall back to stored CDN URL
      let src: string | null = null;
      const fresh = await getFreshMediaUrl(accountId, row.onlyfansMediaId, apiKey);
      if (fresh) src = row.mediaType === "video" ? (fresh.thumb || fresh.preview) : (fresh.preview || fresh.thumb || fresh.full);
      if (!src) src = row.mediaType === "video" ? (row.thumbUrl || row.previewUrl) : (row.previewUrl || row.thumbUrl || row.fullUrl);
      if (!src) return false;
      const permanentUrl = await uploadToSupabase(creatorId, row.creativeId, row.id, src, apiKey, accountId);
      if (permanentUrl) {
        await prisma.outboundMedia.update({ where: { id: row.id }, data: { permanentUrl, persistStatus: "ok", persistedAt: new Date(), lastError: null } });
        return true;
      }
      await prisma.outboundMedia.update({ where: { id: row.id }, data: { persistStatus: "failed", lastError: "download or upload failed" } });
      return false;
    }));
    for (const r of results) { if (r.status === "fulfilled" && r.value) ok++; else failed++; }
    if (i + 3 < mediaRows.length) await new Promise(r => setTimeout(r, 300));
  }
  return { ok, failed };
}

// Refresh CDN URLs for existing non-persisted media (keeps proxy working with fresh URLs)
async function refreshMediaUrls(creativeId: string, media: any[]) {
  for (const mi of media) {
    if (!mi?.id || !mi?.files) continue;
    const d: any = {};
    if (mi.files?.full?.url) d.fullUrl = mi.files.full.url;
    if (mi.files?.preview?.url) d.previewUrl = mi.files.preview.url;
    if (mi.files?.thumb?.url) d.thumbUrl = mi.files.thumb.url;
    if (!Object.keys(d).length) continue;
    await prisma.outboundMedia.updateMany({ where: { creativeId, onlyfansMediaId: String(mi.id), persistStatus: { not: "ok" } }, data: d });
  }
}

// ── Stage 1: Poll + upsert ──

async function pollCreator(creatorId: string, acctId: string, apiKey: string, startDate: Date, now: Date) {
  const s = encodeURIComponent(fmtDate(startDate));
  const e = encodeURIComponent(fmtDate(now));
  let upserted = 0;
  let mediaCreated = 0;

  // ── Mass Messages ──
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
      where: { creatorId_source_externalId: { creatorId, source: "mass_message", externalId } },
      create: {
        creatorId, externalId, source: "mass_message",
        sentAt: m.date ? new Date(m.date) : now,
        textHtml: m.text ?? null, textPlain: m.rawText ?? m.text ?? null,
        isFree: m.isFree !== false, priceCents, purchasedCount,
        mediaCount: m.mediaCount ?? 0, sentCount: m.sentCount ?? 0, viewedCount: m.viewedCount ?? 0,
        isCanceled: m.isCanceled === true, canUnsend: m.canUnsend === true, raw: m,
      },
      update: {
        sentAt: m.date ? new Date(m.date) : now,
        priceCents, purchasedCount, mediaCount: m.mediaCount ?? 0,
        sentCount: m.sentCount ?? 0, viewedCount: m.viewedCount ?? 0,
        isCanceled: m.isCanceled === true, raw: m,
      },
    });
    upserted++;

    // Create or refresh media records
    if (Array.isArray(m.media) && m.media.length > 0) {
      const existingCount = await prisma.outboundMedia.count({ where: { creativeId: row.id } });
      if (existingCount === 0) {
        for (const mi of m.media) {
          if (!mi?.files || (!mi.files?.full?.url && !mi.files?.preview?.url && !mi.files?.thumb?.url)) continue;
          if (mi.canView === false || mi.isReady === false) continue;
          await prisma.outboundMedia.create({
            data: {
              creativeId: row.id,
              onlyfansMediaId: mi.id ? String(mi.id) : null,
              mediaType: mi.type || "photo",
              fullUrl: mi.files?.full?.url ?? null,
              previewUrl: mi.files?.preview?.url ?? null,
              thumbUrl: mi.files?.thumb?.url ?? null,
              persistStatus: "pending",
            },
          });
          mediaCreated++;
        }
      } else {
        // Refresh CDN URLs for non-persisted media (keeps proxy working)
        await refreshMediaUrls(row.id, m.media);
      }
    }
  }

  // ── DMs with media ──
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
      where: { creatorId_source_externalId: { creatorId, source: "direct_message", externalId } },
      create: {
        creatorId, externalId, source: "direct_message",
        sentAt: m.date ? new Date(m.date) : now,
        textHtml: m.text ?? null, textPlain: m.rawText ?? m.text ?? null,
        isFree: m.isFree !== false, priceCents, purchasedCount,
        mediaCount: m.mediaCount ?? m.media?.length ?? 0,
        sentCount: 1, viewedCount: m.isOpened ? 1 : 0,
        isCanceled: false, canUnsend: false, raw: m,
      },
      update: { priceCents, purchasedCount, viewedCount: m.isOpened ? 1 : 0, raw: m },
    });
    upserted++;

    if (Array.isArray(m.media) && m.media.length > 0) {
      const existingCount = await prisma.outboundMedia.count({ where: { creativeId: row.id } });
      if (existingCount === 0) {
        for (const mi of m.media) {
          if (!mi?.files || (!mi.files?.full?.url && !mi.files?.preview?.url && !mi.files?.thumb?.url)) continue;
          if (mi.canView === false || mi.isReady === false) continue;
          await prisma.outboundMedia.create({
            data: {
              creativeId: row.id,
              onlyfansMediaId: mi.id ? String(mi.id) : null,
              mediaType: mi.type || "photo",
              fullUrl: mi.files?.full?.url ?? null,
              previewUrl: mi.files?.preview?.url ?? null,
              thumbUrl: mi.files?.thumb?.url ?? null,
              persistStatus: "pending",
            },
          });
          mediaCreated++;
        }
      } else {
        await refreshMediaUrls(row.id, m.media);
      }
    }
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
        where: { creatorId_source_externalId: { creatorId, source: "wall_post", externalId } },
        create: {
          creatorId, externalId, source: "wall_post",
          sentAt: postDate ? new Date(postDate) : now,
          textHtml: p.text ?? null, textPlain: p.rawText ?? p.text ?? null,
          isFree: p.isFree !== false,
          priceCents: p.price ? Math.round(Number(p.price) * 100) : null,
          mediaCount: p.mediaCount ?? p.media?.length ?? 0,
          sentCount: p.favoritesCount ?? 0, viewedCount: p.viewsCount ?? 0,
          isCanceled: false, canUnsend: false, raw: p,
        },
        update: { sentCount: p.favoritesCount ?? 0, viewedCount: p.viewsCount ?? 0, raw: p },
      });
      upserted++;

      if (Array.isArray(p.media) && p.media.length > 0) {
        const existingCount = await prisma.outboundMedia.count({ where: { creativeId: row.id } });
        if (existingCount === 0) {
          for (const mi of p.media) {
            if (!mi?.files || (!mi.files?.full?.url && !mi.files?.preview?.url && !mi.files?.thumb?.url)) continue;
            if (mi.canView === false || mi.isReady === false) continue;
            await prisma.outboundMedia.create({
              data: {
                creativeId: row.id,
                onlyfansMediaId: mi.id ? String(mi.id) : null,
                mediaType: mi.type || "photo",
                fullUrl: mi.files?.full?.url ?? null,
                previewUrl: mi.files?.preview?.url ?? null,
                thumbUrl: mi.files?.thumb?.url ?? null,
                persistStatus: "pending",
              },
            });
            mediaCreated++;
          }
        } else {
          await refreshMediaUrls(row.id, p.media);
        }
      }
    }
  } catch {}

  return { upserted, mediaCreated };
}

// ── Main task ──

export const syncContent = task({
  id: "sync-content",
  retry: { maxAttempts: 1 },
  machine: "small-2x",
  run: async (payload: { creatorId?: string; daysBack?: number; persistLimit?: number }) => {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return { error: "No OFAPI_API_KEY" };

    const now = new Date();
    const startDate = new Date(now.getTime() - (payload.daysBack || 1) * 24 * 60 * 60 * 1000);

    const where: any = { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } };
    if (payload.creatorId) where.id = payload.creatorId;
    const creators = await prisma.creator.findMany({ where, select: { id: true, name: true, ofapiCreatorId: true } });

    // ── STAGE 1: Poll all creators ──
    let totalUpserted = 0, totalMediaCreated = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      try {
        const result = await pollCreator(creator.id, creator.ofapiCreatorId!, apiKey, startDate, now);
        totalUpserted += result.upserted;
        totalMediaCreated += result.mediaCreated;
        console.log(`[sync] ${creator.name}: ${result.upserted} posts, ${result.mediaCreated} new media`);
      } catch (err: any) {
        errors.push(`${creator.name}: ${err.message}`);
      }
    }

    // ── STAGE 2: Persist pending media (Pattern A — fresh vault URLs) ──
    const persistLimit = payload.persistLimit || 500;
    const pendingMedia = await prisma.outboundMedia.findMany({
      where: { persistStatus: "pending", onlyfansMediaId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: persistLimit,
      include: { creative: { select: { creatorId: true } } },
    });

    // Group by creator for batch processing
    const byCreator = new Map<string, any[]>();
    for (const m of pendingMedia) {
      const cId = m.creative.creatorId;
      if (!byCreator.has(cId)) byCreator.set(cId, []);
      byCreator.get(cId)!.push(m);
    }

    let totalPersisted = 0, totalFailed = 0;
    for (const [creatorId, mediaRows] of byCreator) {
      const creator = creators.find((c) => c.id === creatorId);
      if (!creator?.ofapiCreatorId) continue;
      const result = await persistMediaBatch(creator.ofapiCreatorId, creatorId, mediaRows, apiKey);
      totalPersisted += result.ok;
      totalFailed += result.failed;
      console.log(`[persist] ${creator.name}: ${result.ok} ok, ${result.failed} failed`);
    }

    return {
      stage1: { upserted: totalUpserted, mediaCreated: totalMediaCreated },
      stage2: { persisted: totalPersisted, failed: totalFailed, pending: pendingMedia.length },
      creators: creators.length,
      errors,
    };
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

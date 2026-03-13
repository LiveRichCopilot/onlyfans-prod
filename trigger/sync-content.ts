/**
 * Content Sync Pipeline — Trigger.dev (no Vercel timeout)
 * Stage 1: POLL OFAPI → upsert DB → PERSIST to Supabase IMMEDIATELY (CDN URLs are fresh)
 * Stage 2: RETRY any failed persistence (uses vault for fresh URLs)
 * Media is downloaded from OF CDN at discovery time and permanently stored in Supabase Storage.
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

// ── Media persistence: download from OF CDN → upload to Supabase Storage ──

async function uploadToSupabase(creatorId: string, creativeId: string, mediaId: string, sourceUrl: string, apiKey: string, accountId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    // Download via OFAPI proxy (handles auth + IP restrictions)
    const dlUrl = `${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`;
    const res = await fetch(dlUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const blob = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("video") ? "mp4" : ct.includes("png") ? "png" : "jpg";
    const path = `${creatorId}/${creativeId}/${mediaId}.${ext}`;
    const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": ct, "x-upsert": "true" },
      body: blob,
    });
    if (!upRes.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  } catch { return null; }
}

/**
 * Create OutboundMedia records AND persist to Supabase immediately.
 * CDN URLs from the OFAPI response are fresh right now — download before they expire.
 */
async function createAndPersistMedia(
  creativeId: string, creatorId: string, acctId: string, apiKey: string, mediaItems: any[]
): Promise<{ created: number; persisted: number }> {
  const toPersist: { id: string; mi: any }[] = [];
  for (const mi of mediaItems) {
    if (!mi?.files || (!mi.files?.full?.url && !mi.files?.preview?.url && !mi.files?.thumb?.url)) continue;
    if (mi.canView === false || mi.isReady === false) continue;
    const record = await prisma.outboundMedia.create({
      data: {
        creativeId, onlyfansMediaId: mi.id ? String(mi.id) : null, mediaType: mi.type || "photo",
        fullUrl: mi.files?.full?.url ?? null, previewUrl: mi.files?.preview?.url ?? null,
        thumbUrl: mi.files?.thumb?.url ?? null, persistStatus: "pending",
      },
    });
    toPersist.push({ id: record.id, mi });
  }
  // Persist all in parallel — CDN URLs are fresh right now
  let persisted = 0;
  if (toPersist.length > 0) {
    const results = await Promise.allSettled(toPersist.map(async ({ id, mi }) => {
      const isVideo = (mi.type || "photo") === "video";
      const src = isVideo
        ? (mi.files?.thumb?.url || mi.files?.preview?.url)
        : (mi.files?.preview?.url || mi.files?.thumb?.url || mi.files?.full?.url);
      if (!src) return false;
      const url = await uploadToSupabase(creatorId, creativeId, id, src, apiKey, acctId);
      if (url) {
        await prisma.outboundMedia.update({ where: { id }, data: { permanentUrl: url, persistStatus: "ok", persistedAt: new Date() } });
        return true;
      }
      return false;
    }));
    persisted = results.filter(r => r.status === "fulfilled" && r.value).length;
  }
  return { created: toPersist.length, persisted };
}

// Stage 2 retry: Get fresh URL from vault for old pending media whose CDN URLs expired
async function getFreshMediaUrl(accountId: string, mediaId: string, apiKey: string) {
  try {
    const res = await ofapiFetch(`/api/${accountId}/media/vault/${mediaId}`, apiKey);
    const files = res?.data?.files || res?.files;
    if (!files) return null;
    return { preview: files?.preview?.url, thumb: files?.thumb?.url, full: files?.full?.url };
  } catch { return null; }
}

async function retryPersistBatch(accountId: string, creatorId: string, mediaRows: any[], apiKey: string): Promise<{ ok: number; failed: number }> {
  let ok = 0, failed = 0;
  for (let i = 0; i < mediaRows.length; i += 3) {
    const batch = mediaRows.slice(i, i + 3);
    const results = await Promise.allSettled(batch.map(async (row: any) => {
      if (!row.onlyfansMediaId) return false;
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

// ── Stage 1: Poll + upsert + persist inline ──

async function pollCreator(creatorId: string, acctId: string, apiKey: string, startDate: Date, now: Date) {
  const s = encodeURIComponent(fmtDate(startDate));
  const e = encodeURIComponent(fmtDate(now));
  let upserted = 0, mediaCreated = 0, mediaPersisted = 0;

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
    if (Array.isArray(m.media) && m.media.length > 0) {
      const existingCount = await prisma.outboundMedia.count({ where: { creativeId: row.id } });
      if (existingCount === 0) {
        const r = await createAndPersistMedia(row.id, creatorId, acctId, apiKey, m.media);
        mediaCreated += r.created; mediaPersisted += r.persisted;
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
        const r = await createAndPersistMedia(row.id, creatorId, acctId, apiKey, m.media);
        mediaCreated += r.created; mediaPersisted += r.persisted;
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
          const r = await createAndPersistMedia(row.id, creatorId, acctId, apiKey, p.media);
          mediaCreated += r.created; mediaPersisted += r.persisted;
        }
      }
    }
  } catch {}

  return { upserted, mediaCreated, mediaPersisted };
}

// ── Main task ──

export const syncContent = task({
  id: "sync-content",
  retry: { maxAttempts: 1 },
  machine: "small-2x",
  run: async (payload: { creatorId?: string; daysBack?: number; retryLimit?: number }) => {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return { error: "No OFAPI_API_KEY" };

    const now = new Date();
    const startDate = new Date(now.getTime() - (payload.daysBack || 1) * 24 * 60 * 60 * 1000);

    const where: any = { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } };
    if (payload.creatorId) where.id = payload.creatorId;
    const creators = await prisma.creator.findMany({ where, select: { id: true, name: true, ofapiCreatorId: true } });

    // ── STAGE 1: Poll + persist inline ──
    let totalUpserted = 0, totalMediaCreated = 0, totalPersisted = 0;
    const errors: string[] = [];

    for (const creator of creators) {
      try {
        const result = await pollCreator(creator.id, creator.ofapiCreatorId!, apiKey, startDate, now);
        totalUpserted += result.upserted;
        totalMediaCreated += result.mediaCreated;
        totalPersisted += result.mediaPersisted;
        console.log(`[sync] ${creator.name}: ${result.upserted} posts, ${result.mediaCreated} media (${result.mediaPersisted} persisted to Supabase)`);
      } catch (err: any) {
        errors.push(`${creator.name}: ${err.message}`);
      }
    }

    // ── STAGE 2: Retry old pending/failed media (vault for fresh URLs) ──
    const retryLimit = payload.retryLimit || 200;
    const pendingMedia = await prisma.outboundMedia.findMany({
      where: { persistStatus: { in: ["pending", "failed"] }, onlyfansMediaId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: retryLimit,
      include: { creative: { select: { creatorId: true } } },
    });

    const byCreator = new Map<string, any[]>();
    for (const m of pendingMedia) {
      const cId = m.creative.creatorId;
      if (!byCreator.has(cId)) byCreator.set(cId, []);
      byCreator.get(cId)!.push(m);
    }

    let retryOk = 0, retryFailed = 0;
    for (const [creatorId, mediaRows] of byCreator) {
      const creator = creators.find((c) => c.id === creatorId);
      if (!creator?.ofapiCreatorId) continue;
      const result = await retryPersistBatch(creator.ofapiCreatorId, creatorId, mediaRows, apiKey);
      retryOk += result.ok;
      retryFailed += result.failed;
      if (retryOk + retryFailed > 0) console.log(`[retry] ${creator.name}: ${result.ok} ok, ${result.failed} failed`);
    }

    return {
      stage1: { upserted: totalUpserted, mediaCreated: totalMediaCreated, persisted: totalPersisted },
      stage2_retry: { ok: retryOk, failed: retryFailed, attempted: pendingMedia.length },
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

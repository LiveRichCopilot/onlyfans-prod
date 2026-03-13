/**
 * Media Persistence — Aggressive Backfill
 *
 * Downloads media from OF via vault fresh URLs → uploads to Supabase Storage.
 * Designed to clear the backlog fast: 500/run, 5 concurrent, every 2 minutes.
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const OFAPI_BASE = "https://app.onlyfansapi.com";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "content-media";

async function getFreshUrl(accountId: string, mediaId: string, apiKey: string) {
  try {
    const res = await fetch(`${OFAPI_BASE}/api/${accountId}/media/vault/${mediaId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const files = json?.data?.files || json?.files;
    if (!files) return null;
    return { preview: files?.preview?.url, thumb: files?.thumb?.url, full: files?.full?.url };
  } catch { return null; }
}

async function downloadAndUpload(
  creatorId: string, creativeId: string, mediaId: string,
  sourceUrl: string, apiKey: string, accountId: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const dlUrl = `${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`;
    const res = await fetch(dlUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const blob = await res.arrayBuffer();
    if (blob.byteLength < 1000) return null; // skip tiny/broken responses
    const ct = res.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("video") ? "mp4" : ct.includes("png") ? "png" : "jpg";
    const path = `${creatorId}/${creativeId}/${mediaId}.${ext}`;
    const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": ct, "x-upsert": "true" },
      body: blob,
    });
    if (!upRes.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch { return null; }
}

export const mediaPersistence = task({
  id: "media-persistence",
  retry: { maxAttempts: 1 },
  machine: "small-2x",
  run: async (payload: { limit?: number; concurrency?: number }) => {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return { error: "No OFAPI_API_KEY" };

    const limit = payload.limit || 500;
    const concurrency = payload.concurrency || 5;

    // Find pending media with OF media IDs (needed for vault lookup)
    const media = await prisma.outboundMedia.findMany({
      where: {
        persistStatus: { in: ["pending", "failed"] },
        onlyfansMediaId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { creative: { select: { creatorId: true } } },
    });

    if (media.length === 0) return { persisted: 0, failed: 0, message: "No pending media" };

    // Build creator → accountId map
    const creatorIds = [...new Set(media.map(m => m.creative.creatorId))];
    const creators = await prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, ofapiCreatorId: true },
    });
    const acctMap = new Map(creators.map(c => [c.id, c.ofapiCreatorId]));

    let persisted = 0, failed = 0;

    // Process in concurrent batches
    for (let i = 0; i < media.length; i += concurrency) {
      const batch = media.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map(async (row) => {
        const accountId = acctMap.get(row.creative.creatorId);
        if (!accountId || !row.onlyfansMediaId) return false;

        // Get fresh URL from vault (stored CDN URLs are expired)
        const fresh = await getFreshUrl(accountId, row.onlyfansMediaId, apiKey);
        const isVideo = row.mediaType === "video";
        let src: string | null = null;
        if (fresh) src = isVideo ? (fresh.thumb || fresh.preview) : (fresh.preview || fresh.thumb || fresh.full);
        if (!src) {
          await prisma.outboundMedia.update({
            where: { id: row.id },
            data: { persistStatus: "failed", lastError: "no vault URL" },
          });
          return false;
        }

        const permanentUrl = await downloadAndUpload(
          row.creative.creatorId, row.creativeId, row.id, src, apiKey, accountId
        );
        if (permanentUrl) {
          await prisma.outboundMedia.update({
            where: { id: row.id },
            data: { permanentUrl, persistStatus: "ok", persistedAt: new Date(), lastError: null },
          });
          return true;
        }
        await prisma.outboundMedia.update({
          where: { id: row.id },
          data: { persistStatus: "failed", lastError: "download/upload failed" },
        });
        return false;
      }));

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) persisted++;
        else failed++;
      }

      // Brief pause between batches to avoid rate limits
      if (i + concurrency < media.length) await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[media-persist] ${persisted} ok, ${failed} failed out of ${media.length}`);
    return { persisted, failed, total: media.length };
  },
});

// Run every 2 minutes — aggressive backfill until backlog is clear
export const mediaPersistenceScheduled = schedules.task({
  id: "media-persistence-scheduled",
  cron: "*/2 * * * *",
  run: async () => {
    const result = await mediaPersistence.triggerAndWait({ limit: 500, concurrency: 5 });
    return result;
  },
});

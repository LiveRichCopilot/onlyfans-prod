import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OFAPI_BASE = "https://app.onlyfansapi.com";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MEDIA_BUCKET = "content-media";

async function getFreshUrl(accountId: string, mediaId: string, apiKey: string) {
  try {
    const res = await fetch(`${OFAPI_BASE}/api/${accountId}/media/vault/${mediaId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const files = data?.data?.files || data?.files;
    if (!files) return null;
    return { full: files?.full?.url, preview: files?.preview?.url, thumb: files?.thumb?.url };
  } catch { return null; }
}

async function uploadToSupabase(path: string, sourceUrl: string, apiKey: string, accountId: string): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const dlUrl = `${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`;
    const res = await fetch(dlUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const blob = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/jpeg";
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
 * POST /api/backfill/retry-media
 * Body: { limit?: number }
 * Retries all pending/failed OutboundMedia by fetching fresh URLs from OFAPI vault.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return NextResponse.json({ error: "No OFAPI_API_KEY" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 200;

    const pending = await prisma.outboundMedia.findMany({
      where: { persistStatus: { in: ["pending", "failed"] }, onlyfansMediaId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { creative: { select: { creatorId: true } } },
    });

    if (pending.length === 0) return NextResponse.json({ message: "No pending media", ok: 0, failed: 0 });

    // Group by creator to resolve account IDs
    const creatorIds = [...new Set(pending.map((m) => m.creative.creatorId))];
    const creators = await prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, ofapiCreatorId: true },
    });
    const creatorAcctMap = Object.fromEntries(creators.map((c) => [c.id, c.ofapiCreatorId]));

    let ok = 0, failed = 0, skipped = 0;
    for (const row of pending) {
      const acctId = creatorAcctMap[row.creative.creatorId];
      if (!acctId || !row.onlyfansMediaId) { skipped++; continue; }

      const fresh = await getFreshUrl(acctId, row.onlyfansMediaId, apiKey);
      const isVideo = row.mediaType === "video";
      const src = fresh
        ? (isVideo ? (fresh.thumb || fresh.preview) : (fresh.preview || fresh.thumb || fresh.full))
        : (isVideo ? (row.thumbUrl || row.previewUrl) : (row.previewUrl || row.thumbUrl || row.fullUrl));

      if (!src) { failed++; continue; }

      // Update CDN URLs if we got fresh ones
      if (fresh) {
        await prisma.outboundMedia.update({
          where: { id: row.id },
          data: { fullUrl: fresh.full || row.fullUrl, previewUrl: fresh.preview || row.previewUrl, thumbUrl: fresh.thumb || row.thumbUrl },
        });
      }

      const path = `${row.creative.creatorId}/${row.creativeId}/${row.id}.${isVideo ? "jpg" : "jpg"}`;
      const permanentUrl = await uploadToSupabase(path, src, apiKey, acctId);
      if (permanentUrl) {
        await prisma.outboundMedia.update({
          where: { id: row.id },
          data: { permanentUrl, persistStatus: "ok", persistedAt: new Date(), lastError: null },
        });
        ok++;
      } else {
        await prisma.outboundMedia.update({
          where: { id: row.id },
          data: { persistStatus: "failed", lastError: "retry download/upload failed" },
        });
        failed++;
      }

      // Small delay to avoid rate limiting
      if ((ok + failed) % 5 === 0) await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({ total: pending.length, ok, failed, skipped });
  } catch (err: any) {
    console.error("[retry-media]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

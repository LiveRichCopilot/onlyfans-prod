import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";
const MEDIA_BUCKET = "content-media";

// Cache one active creator account name to avoid DB hit on every media request
let cachedAccount: { name: string; ts: number } | null = null;
const ACCOUNT_CACHE_TTL = 300_000; // 5 min

// In-flight dedupe: concurrent requests for the same cacheKey share one OFAPI download
const inflight = new Map<string, Promise<{ body: ArrayBuffer; contentType: string } | null>>();

/** Extract a stable cache key from an OF CDN URL (path only, no signed tokens) */
function getCacheKey(url: string): string {
    try {
        const parsed = new URL(url);
        // OF CDN path is stable; query params are signed tokens that change
        return crypto.createHash("sha256").update(parsed.pathname).digest("hex").slice(0, 32);
    } catch {
        return crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
    }
}

/** Try to serve from Supabase Storage cache */
async function serveCached(cacheKey: string): Promise<Response | null> {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/proxy-cache/${cacheKey}`;
    try {
        const res = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
        if (res.ok) return Response.redirect(publicUrl, 302);
    } catch { /* not cached */ }
    return null;
}

/** Upload to Supabase Storage cache (fire-and-forget) */
function cacheInStorage(cacheKey: string, body: ArrayBuffer, contentType: string) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return;
    const path = `proxy-cache/${cacheKey}`;
    fetch(`${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": contentType,
            "x-upsert": "true",
        },
        body: body,
    }).catch(() => {});
}

async function resolveAccountName(creatorId: string | null): Promise<string | null> {
    if (creatorId) {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (creator?.ofapiCreatorId) return creator.ofapiCreatorId;
    }
    if (cachedAccount && Date.now() - cachedAccount.ts < ACCOUNT_CACHE_TTL) {
        return cachedAccount.name;
    }
    const anyCreator = await prisma.creator.findFirst({
        where: { active: true, ofapiCreatorId: { not: null } },
        select: { ofapiCreatorId: true },
    });
    if (anyCreator?.ofapiCreatorId) {
        cachedAccount = { name: anyCreator.ofapiCreatorId, ts: Date.now() };
        return anyCreator.ofapiCreatorId;
    }
    return null;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    const creatorId = searchParams.get("creatorId") || null;

    if (!targetUrl) {
        return new NextResponse("Missing url parameter", { status: 400 });
    }

    // Supabase Storage URLs are permanent — fetch directly, no OFAPI needed
    if (targetUrl.includes(".supabase.co/storage/")) {
        try {
            const response = await fetch(targetUrl, {
                headers: { Accept: "image/*, video/*, audio/*, */*" },
            });
            if (response.ok) {
                return new NextResponse(response.body as any, {
                    status: 200,
                    headers: {
                        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
                        "Cache-Control": "public, max-age=31536000, immutable",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }
        } catch (e: any) {
            console.warn("[proxy] Supabase fetch error:", e.message);
        }
    }

    const apiKey = process.env.OFAPI_API_KEY;
    const isOfUrl = targetUrl.includes("onlyfans.com");

    // For OF CDN URLs: check cache first, then OFAPI, then persist to cache
    if (apiKey && isOfUrl) {
        const cacheKey = getCacheKey(targetUrl);

        // 1. Check Supabase Storage cache — skip OFAPI entirely if cached
        const cached = await serveCached(cacheKey);
        if (cached) return cached;

        // 2. Not cached — download via OFAPI (with in-flight dedupe)
        try {
            let downloadPromise = inflight.get(cacheKey);
            if (!downloadPromise) {
                downloadPromise = (async () => {
                    const accountName = await resolveAccountName(creatorId);
                    if (!accountName) return null;
                    const downloadUrl = `${OFAPI_BASE}/api/${accountName}/media/download/${targetUrl}`;
                    const response = await fetch(downloadUrl, {
                        headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*, video/*, audio/*, */*" },
                    });
                    if (!response.ok) {
                        console.warn(`[proxy] OFAPI download ${response.status} for ${targetUrl.substring(0, 60)}...`);
                        return null;
                    }
                    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
                    const body = await response.arrayBuffer();
                    cacheInStorage(cacheKey, body, contentType);
                    return { body, contentType };
                })();
                inflight.set(cacheKey, downloadPromise);
                downloadPromise.finally(() => inflight.delete(cacheKey));
            }

            const result = await downloadPromise;
            if (result) {
                return new NextResponse(result.body, {
                    status: 200,
                    headers: {
                        "Content-Type": result.contentType,
                        "Cache-Control": "public, max-age=86400",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }
        } catch (e: any) {
            console.warn("[proxy] OFAPI download error:", e.message);
        }
    }

    // Fallback: direct fetch (works for non-OF URLs: external avatars, CDN assets, etc.)
    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Accept: "image/*, video/*, audio/*, */*",
            },
        });

        if (!response.ok) {
            if (isOfUrl) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-cache" } });
            return new NextResponse(`Failed to fetch media: ${response.statusText}`, { status: response.status });
        }

        return new NextResponse(response.body as any, {
            status: 200,
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
                "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (e: any) {
        console.error("[proxy] error:", e.message);
        return new NextResponse(`Media proxy internal error: ${e.message}`, { status: 500 });
    }
}

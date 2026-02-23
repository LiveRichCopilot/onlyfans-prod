import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";

// Cache one active creator account name to avoid DB hit on every media request
let cachedAccount: { name: string; ts: number } | null = null;
const ACCOUNT_CACHE_TTL = 300_000; // 5 min

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    const creatorId = searchParams.get("creatorId");

    if (!targetUrl) {
        return new NextResponse("Missing url parameter", { status: 400 });
    }

    const apiKey = process.env.OFAPI_API_KEY;
    const isOfUrl = targetUrl.includes("onlyfans.com");

    // For OnlyFans CDN URLs, ALWAYS route through OFAPI download
    // Direct fetch from Vercel gets 403 because OF CDN is IP-locked
    if (apiKey && isOfUrl) {
        try {
            let accountName: string | null = null;

            // If creatorId provided, use that specific creator
            if (creatorId) {
                const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
                accountName = creator?.ofapiCreatorId || creator?.telegramId || null;
            }

            // If no creatorId, use any active creator (all share the same OFAPI access)
            if (!accountName) {
                if (cachedAccount && Date.now() - cachedAccount.ts < ACCOUNT_CACHE_TTL) {
                    accountName = cachedAccount.name;
                } else {
                    const anyCreator = await prisma.creator.findFirst({
                        where: { active: true, ofapiCreatorId: { not: null } },
                        select: { ofapiCreatorId: true },
                    });
                    if (anyCreator?.ofapiCreatorId) {
                        accountName = anyCreator.ofapiCreatorId;
                        cachedAccount = { name: accountName, ts: Date.now() };
                    }
                }
            }

            if (accountName) {
                const downloadUrl = `${OFAPI_BASE}/api/${accountName}/media/download/${targetUrl}`;
                const response = await fetch(downloadUrl, {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Accept": "image/*, video/*, audio/*, */*",
                    },
                });

                if (response.ok) {
                    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
                    const contentLength = response.headers.get("Content-Length");
                    const headers: HeadersInit = {
                        "Content-Type": contentType,
                        "Cache-Control": "public, max-age=3600",
                        "Access-Control-Allow-Origin": "*",
                    };
                    if (contentLength) headers["Content-Length"] = contentLength;
                    return new NextResponse(response.body as any, { status: 200, headers });
                }
                // Log but don't fail — fall through to direct attempt
                console.warn(`[proxy] OFAPI download ${response.status} for ${targetUrl.substring(0, 60)}...`);
            }
        } catch (e: any) {
            console.warn("[proxy] OFAPI download error:", e.message);
        }
    }

    // Fallback: direct fetch (works for non-OF URLs: external avatars, CDN assets, etc.)
    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/*, video/*, audio/*, */*",
            },
        });

        if (!response.ok) {
            // For OF URLs that failed both paths, return a transparent 1px placeholder instead of error
            if (isOfUrl) {
                return new NextResponse(null, {
                    status: 204,
                    headers: { "Cache-Control": "no-cache" },
                });
            }
            return new NextResponse(`Failed to fetch media: ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        const contentLength = response.headers.get("Content-Length");
        const headers: HeadersInit = {
            "Content-Type": contentType,
            "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        };
        if (contentLength) headers["Content-Length"] = contentLength;

        return new NextResponse(response.body as any, { status: 200, headers });
    } catch (e: any) {
        console.error("[proxy] error:", e.message);
        return new NextResponse(`Media proxy internal error: ${e.message}`, { status: 500 });
    }
}

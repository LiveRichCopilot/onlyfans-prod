import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    const creatorId = searchParams.get("creatorId");

    if (!targetUrl) {
        return new NextResponse("Missing url parameter", { status: 400 });
    }

    const apiKey = process.env.OFAPI_API_KEY;

    // If we have creatorId + API key and it's an OF CDN URL, route through OFAPI download
    // This bypasses IP-locked CloudFront URLs that cause 403s from Vercel
    if (apiKey && creatorId && targetUrl.includes("onlyfans.com")) {
        try {
            const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
            if (creator) {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                // OFAPI download endpoint: pass CDN URL unencoded after the path
                const downloadUrl = `${OFAPI_BASE}/api/${accountName}/media/download/${targetUrl}`;
                const response = await fetch(downloadUrl, {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Accept": "image/*, video/*, audio/*, */*"
                    }
                });

                if (response.ok) {
                    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
                    const contentLength = response.headers.get("Content-Length");
                    const headers: HeadersInit = {
                        "Content-Type": contentType,
                        "Cache-Control": "public, max-age=3600",
                        "Access-Control-Allow-Origin": "*"
                    };
                    if (contentLength) headers["Content-Length"] = contentLength;
                    return new NextResponse(response.body as any, { status: 200, headers });
                }
                // If OFAPI download fails, fall through to direct fetch
                console.error(`OFAPI download failed: ${response.status} for ${targetUrl.substring(0, 80)}...`);
            }
        } catch (e: any) {
            console.error("OFAPI download error:", e.message);
        }
    }

    // Fallback: direct fetch (works for non-IP-locked URLs like public avatars)
    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/*, video/*, audio/*, */*"
            }
        });

        if (!response.ok) {
            console.error(`Proxy Fetch Failed: ${response.status} ${response.statusText} for URL ${targetUrl.substring(0, 80)}...`);
            return new NextResponse(`Failed to fetch media: ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        const contentLength = response.headers.get("Content-Length");
        const headers: HeadersInit = {
            "Content-Type": contentType,
            "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=86400",
            "Access-Control-Allow-Origin": "*"
        };
        if (contentLength) headers["Content-Length"] = contentLength;

        return new NextResponse(response.body as any, { status: 200, headers });
    } catch (e: any) {
        console.error("Media proxy error:", e);
        return new NextResponse(`Media proxy internal error: ${e.message}`, { status: 500 });
    }
}

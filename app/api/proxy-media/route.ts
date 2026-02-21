import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
        return new NextResponse("Missing url parameter", { status: 400 });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // Stripping origin and referer to bypass simple hotlink blocks,
                // or optionally spoofing them if OnlyFans strictly requires it.
                // Standard fetch generally works if we just act as a proxy.
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/*, video/*, audio/*, */*"
            }
        });

        if (!response.ok) {
            console.error(`Proxy Fetch Failed: ${response.status} ${response.statusText} for URL ${targetUrl}`);
            return new NextResponse(`Failed to fetch media: ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        const contentLength = response.headers.get("Content-Length");
        const cacheControl = response.headers.get("Cache-Control") || "public, max-age=86400"; // Cache for 1 day

        const headers: HeadersInit = {
            "Content-Type": contentType,
            "Cache-Control": cacheControl,
            "Access-Control-Allow-Origin": "*"
        };

        if (contentLength) {
            headers["Content-Length"] = contentLength;
        }

        return new NextResponse(response.body as any, {
            status: 200,
            headers,
        });
    } catch (e: any) {
        console.error("Media proxy error:", e);
        return new NextResponse(`Media proxy internal error: ${e.message}`, { status: 500 });
    }
}

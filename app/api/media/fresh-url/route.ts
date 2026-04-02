import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";

/**
 * GET /api/media/fresh-url?mediaId=<OutboundMedia.id>
 * Fetches fresh CDN URLs from OFAPI vault for a specific media item.
 * Used for video playback — CDN URLs expire after ~30min.
 */
export async function GET(req: NextRequest) {
  try {
    const mediaId = req.nextUrl.searchParams.get("mediaId");
    if (!mediaId) return NextResponse.json({ error: "mediaId required" }, { status: 400 });

    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return NextResponse.json({ error: "No OFAPI_API_KEY" }, { status: 500 });

    // Look up the media record to get the OF media ID and creator
    const media = await prisma.outboundMedia.findUnique({
      where: { id: mediaId },
      select: { onlyfansMediaId: true, fullUrl: true, previewUrl: true, thumbUrl: true, mediaType: true, creative: { select: { creatorId: true } } },
    });
    if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    // Resolve creator's OFAPI account ID
    const creator = await prisma.creator.findUnique({
      where: { id: media.creative.creatorId },
      select: { ofapiCreatorId: true },
    });
    if (!creator?.ofapiCreatorId) return NextResponse.json({ error: "Creator not linked" }, { status: 404 });

    // Fetch fresh URLs from OFAPI vault
    if (media.onlyfansMediaId) {
      const res = await fetch(`${OFAPI_BASE}/api/${creator.ofapiCreatorId}/media/vault/${media.onlyfansMediaId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const files = data?.data?.files || data?.files;
        const videoSources = data?.data?.videoSources || data?.videoSources;
        if (files || videoSources) {
          return NextResponse.json({
            full: files?.full?.url || null,
            preview: files?.preview?.url || null,
            thumb: files?.thumb?.url || null,
            videoSources: videoSources || null,
            mediaType: media.mediaType,
          });
        }
      }
    }

    // Fallback: return whatever CDN URLs we have stored (may be expired)
    return NextResponse.json({
      full: media.fullUrl,
      preview: media.previewUrl,
      thumb: media.thumbUrl,
      videoSources: null,
      mediaType: media.mediaType,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

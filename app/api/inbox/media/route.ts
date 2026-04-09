import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMedia } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

// Cache getChatMedia results — media URLs valid for ~30min, 5min TTL is safe
const mediaCache = new Map<string, { data: Record<string, any>; ts: number }>();
const MEDIA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get fresh media URLs for a specific chat.
 * OF CDN URLs expire — this endpoint returns fresh signed URLs
 * that the frontend can use immediately.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const chatId = searchParams.get("chatId");

    if (!creatorId || !chatId) {
        return NextResponse.json({ error: "Missing creatorId or chatId" }, { status: 400 });
    }

    try {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;
        const cacheKey = `${creatorId}:${chatId}`;
        const cached = mediaCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < MEDIA_CACHE_TTL) {
            return NextResponse.json({ media: cached.data });
        }

        const rawMedia = await getChatMedia(accountName, chatId, apiKey);

        // Build a lookup map: mediaId -> fresh URLs
        const mediaList = rawMedia?.list || rawMedia?.data?.list || rawMedia?.data || rawMedia || [];
        const mediaMap: Record<string, { src: string; preview: string; type: string }> = {};

        if (Array.isArray(mediaList)) {
            for (const med of mediaList) {
                const id = med.id?.toString();
                if (!id) continue;
                mediaMap[id] = {
                    src: med.full || med.src || med.source?.source || med.source?.url
                        || med.files?.source?.url || med.video?.url || med.audio?.url || "",
                    preview: med.preview || med.thumb || med.squarePreview
                        || med.files?.preview?.url || "",
                    type: med.type || "photo",
                };
            }
        }

        mediaCache.set(cacheKey, { data: mediaMap, ts: Date.now() });
        // Evict stale entries
        if (mediaCache.size > 200) {
            const now = Date.now();
            for (const [k, v] of mediaCache) {
                if (now - v.ts > MEDIA_CACHE_TTL) mediaCache.delete(k);
            }
        }

        return NextResponse.json({ media: mediaMap });
    } catch (e: any) {
        console.error("Inbox media error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

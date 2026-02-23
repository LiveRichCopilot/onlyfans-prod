import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/inbox/ppv-history — Scan chat messages for PPV items
 *
 * ?creatorId=xxx&chatId=xxx
 *
 * Scans up to 500 messages (5 pages) for PPV content (price > 0).
 * Returns PPV cards with: media thumbnails, price, purchased status,
 * mass/direct indicator, date, mediaCount.
 *
 * PPV detection: price > 0
 * Purchased: isOpened === true
 * Mass vs Direct: isFromQueue === true means mass message
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const chatId = searchParams.get("chatId");

    if (!creatorId || !chatId) {
        return NextResponse.json({ error: "Missing creatorId or chatId" }, { status: 400 });
    }

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
    }

    try {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator?.ofapiCreatorId) {
            return NextResponse.json({ error: "Creator not linked" }, { status: 404 });
        }

        const accountName = creator.ofapiCreatorId;

        // Paginate through messages to find all PPVs (up to 500 messages)
        const allPpvs: any[] = [];
        let cursor: string | undefined;
        let totalMessages = 0;
        const maxPages = 5;

        for (let page = 0; page < maxPages; page++) {
            const res = await getChatMessages(accountName, chatId, apiKey, 100, cursor);
            const msgs: any[] = res?.data?.list || res?.list || (Array.isArray(res?.data) ? res.data : []);

            if (msgs.length === 0) break;
            totalMessages += msgs.length;

            // Extract PPVs (price > 0)
            for (const msg of msgs) {
                const price = Number(msg.price) || 0;
                if (price <= 0) continue;

                // Build media thumbnails
                const thumbnails: { id: string; type: string; thumb: string; preview: string }[] = [];
                const mediaList = msg.media || [];

                for (const med of mediaList) {
                    thumbnails.push({
                        id: String(med.id || ""),
                        type: med.type || "photo",
                        thumb: med.files?.thumb?.url || med.files?.squarePreview?.url || "",
                        preview: med.files?.preview?.url || med.files?.full?.url || "",
                    });
                }

                allPpvs.push({
                    messageId: String(msg.id),
                    createdAt: msg.createdAt || msg.created_at,
                    price,
                    purchased: msg.isOpened === true,
                    isMass: msg.isFromQueue === true,
                    isFree: msg.isFree === true,
                    mediaCount: msg.mediaCount || mediaList.length,
                    thumbnails: thumbnails.slice(0, 3), // Max 3 thumbs per card
                    totalThumbs: thumbnails.length,
                    text: (msg.text || "").replace(/<[^>]*>/g, "").slice(0, 100),
                    // For "copy as draft" — store media IDs
                    mediaIds: mediaList.map((m: any) => m.id).filter(Boolean),
                });
            }

            // Get cursor for next page
            const nextPage = res?._pagination?.next_page;
            if (!nextPage || res?.data?.hasMore === false) break;

            // Extract cursor from next_page URL
            const nextUrl = new URL(nextPage, "https://app.onlyfansapi.com");
            cursor = nextUrl.searchParams.get("id") || undefined;
            if (!cursor) break;
        }

        // Sort by date descending (newest first)
        allPpvs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Compute stats
        const totalPpv = allPpvs.length;
        const purchasedCount = allPpvs.filter(p => p.purchased).length;
        const notPurchasedCount = totalPpv - purchasedCount;
        const buyRate = totalPpv > 0 ? Math.round((purchasedCount / totalPpv) * 100) : 0;
        const totalRevenue = allPpvs.filter(p => p.purchased).reduce((sum, p) => sum + p.price, 0);
        const highestPrice = allPpvs.length > 0 ? Math.max(...allPpvs.map(p => p.price)) : 0;
        const lowestPrice = allPpvs.length > 0 ? Math.min(...allPpvs.map(p => p.price)) : 0;

        const massCount = allPpvs.filter(p => p.isMass).length;
        const directCount = totalPpv - massCount;

        return NextResponse.json({
            ppvs: allPpvs,
            stats: {
                totalPpv,
                purchasedCount,
                notPurchasedCount,
                buyRate,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                highestPrice,
                lowestPrice,
                massCount,
                directCount,
                messagesScanned: totalMessages,
            },
        });
    } catch (e: any) {
        console.error("PPV history error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

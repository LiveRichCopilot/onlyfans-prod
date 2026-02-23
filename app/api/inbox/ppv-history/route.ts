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
 * PPV detection: price > 0 (paid message)
 * Purchased: isOpened === true
 * Mass vs Direct: isFromQueue === true
 *
 * Scans up to 300 messages (3 pages of 100) to balance speed vs coverage.
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

        // Paginate through messages to find all PPVs
        const allPpvs: any[] = [];
        let cursor: string | undefined;
        let totalMessages = 0;
        const maxPages = 3; // 3 pages x 100 = 300 messages max for speed
        let debugSample: any = null; // First message for debugging

        for (let page = 0; page < maxPages; page++) {
            const res = await getChatMessages(accountName, chatId, apiKey, 100, cursor);
            const msgs: any[] = res?.data?.list || res?.list || (Array.isArray(res?.data) ? res.data : []);

            if (msgs.length === 0) break;
            totalMessages += msgs.length;

            // Capture first message for debugging (helps identify field names)
            if (!debugSample && msgs.length > 0) {
                const m = msgs[0];
                debugSample = {
                    id: m.id,
                    price: m.price,
                    priceType: typeof m.price,
                    isOpened: m.isOpened,
                    isFree: m.isFree,
                    isFromQueue: m.isFromQueue,
                    mediaCount: m.mediaCount,
                    hasMedia: (m.media || []).length > 0,
                    // Check alternative field names
                    lockedText: m.lockedText,
                    isPaid: m.isPaid,
                    tip_amount: m.tip_amount,
                    isTip: m.isTip,
                };
            }

            // Extract PPVs — check multiple possible "paid" indicators
            for (const msg of msgs) {
                const price = Number(msg.price) || 0;
                const isTip = msg.isTip === true;
                const tipAmount = Number(msg.tip_amount) || 0;

                // PPV: has a price > 0 (paid content) OR is a tip with amount
                const isPpv = price > 0;
                const effectivePrice = price || tipAmount;

                if (!isPpv && !isTip) continue;
                if (effectivePrice <= 0) continue;

                // Build media thumbnails
                const thumbnails: { id: string; type: string; thumb: string; preview: string }[] = [];
                const mediaList = msg.media || [];

                for (const med of mediaList) {
                    const thumb = med.files?.thumb?.url || med.files?.squarePreview?.url || med.thumb || "";
                    const preview = med.files?.preview?.url || med.files?.full?.url || med.preview || med.src || "";
                    thumbnails.push({
                        id: String(med.id || ""),
                        type: med.type || "photo",
                        thumb,
                        preview,
                    });
                }

                // Also check previews array (separate from media)
                if (thumbnails.length === 0 && msg.previews && Array.isArray(msg.previews)) {
                    for (const prev of msg.previews) {
                        thumbnails.push({
                            id: String(prev.id || ""),
                            type: prev.type || "photo",
                            thumb: prev.files?.thumb?.url || prev.src || "",
                            preview: prev.files?.preview?.url || prev.src || "",
                        });
                    }
                }

                allPpvs.push({
                    messageId: String(msg.id),
                    createdAt: msg.createdAt || msg.created_at || msg.changedAt,
                    price: effectivePrice,
                    purchased: msg.isOpened === true,
                    isTip,
                    isMass: msg.isFromQueue === true,
                    isFree: msg.isFree === true,
                    mediaCount: msg.mediaCount || mediaList.length,
                    thumbnails: thumbnails.slice(0, 3),
                    totalThumbs: thumbnails.length,
                    text: (msg.text || "").replace(/<[^>]*>/g, "").slice(0, 100),
                    mediaIds: mediaList.map((m: any) => m.id).filter(Boolean),
                });
            }

            // Get cursor for next page
            const nextPage = res?._pagination?.next_page;
            const hasMoreData = res?.data?.hasMore;
            if (!nextPage && hasMoreData === false) break;
            if (hasMoreData === false) break;

            // Extract cursor from nextLastId or next_page URL
            const nextLastId = res?.data?.nextLastId;
            if (nextLastId) {
                cursor = String(nextLastId);
            } else if (nextPage) {
                try {
                    const nextUrl = new URL(nextPage, "https://app.onlyfansapi.com");
                    cursor = nextUrl.searchParams.get("id") || undefined;
                } catch {
                    break;
                }
            } else {
                break;
            }
        }

        // Sort by date descending
        allPpvs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Stats
        const totalPpv = allPpvs.length;
        const purchasedCount = allPpvs.filter(p => p.purchased).length;
        const notPurchasedCount = totalPpv - purchasedCount;
        const buyRate = totalPpv > 0 ? Math.round((purchasedCount / totalPpv) * 100) : 0;
        const totalRevenue = allPpvs.filter(p => p.purchased).reduce((sum, p) => sum + p.price, 0);
        const prices = allPpvs.map(p => p.price);
        const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
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
            // Debug info (remove in production later)
            _debug: {
                accountName,
                chatId,
                totalMessages,
                ppvsFound: totalPpv,
                sampleMessage: debugSample,
            },
        });
    } catch (e: any) {
        console.error("PPV history error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

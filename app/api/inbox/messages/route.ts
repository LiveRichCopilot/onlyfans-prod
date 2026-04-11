import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages, sendChatMessage, sendTypingIndicator } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/messages
 * Serves messages from local DB (RawChatMessage) — populated by webhooks in real-time.
 * Falls back to live OFAPI only if DB has zero messages for this chat (first open).
 * This eliminates ~720 OFAPI calls/hour per active user from 5s polling.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const chatId = searchParams.get("chatId");
    const before = searchParams.get("before") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);

    if (!creatorId || !chatId) {
        return NextResponse.json({ error: "Missing creatorId or chatId" }, { status: 400 });
    }

    try {
        // Try DB first — webhooks populate RawChatMessage in real-time
        const whereClause: any = { creatorId, chatId };
        if (before) {
            // Pagination: get messages older than cursor
            const cursorMsg = await prisma.rawChatMessage.findFirst({
                where: { creatorId, ofMessageId: before },
                select: { sentAt: true },
            });
            if (cursorMsg) {
                whereClause.sentAt = { lt: cursorMsg.sentAt };
            }
        }

        const dbMessages = await prisma.rawChatMessage.findMany({
            where: whereClause,
            orderBy: { sentAt: "desc" },
            take: limit,
        });

        // If DB has messages, serve from DB (free — no OFAPI call)
        if (dbMessages.length > 0) {
            const messages = dbMessages.map((m) => {
                // Return the full raw OFAPI payload if available, enriched with DB fields
                const raw = (m.raw as any) || {};
                return {
                    ...raw, // Spread full raw payload first for any extra fields
                    id: m.ofMessageId,
                    text: m.text || raw.text || "",
                    createdAt: m.sentAt.toISOString(),
                    fromUser: raw.fromUser || { id: m.fromUserId },
                    isFromCreator: m.isFromCreator,
                    price: m.price,
                    isFree: m.isFree,
                    mediaCount: m.mediaCount,
                    media: raw.media || [],
                    isLiked: m.isLiked,
                    isTip: m.isTip,
                    tipAmount: m.tipAmount,
                };
            }).reverse(); // Reverse to ascending order (oldest first)

            const hasMore = dbMessages.length >= limit;
            const nextLastId = dbMessages.length > 0 ? dbMessages[dbMessages.length - 1].ofMessageId : null;

            return NextResponse.json({ messages, hasMore, nextLastId });
        }

        // DB empty for this chat — fall back to live OFAPI (first open only)
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;
        const rawResponse = await getChatMessages(accountName, chatId, apiKey, limit, before);

        const messages = rawResponse?.data?.list || rawResponse?.list
            || (Array.isArray(rawResponse?.data) ? rawResponse.data : null)
            || rawResponse || [];
        const hasMore = rawResponse?.data?.hasMore ?? (Array.isArray(messages) && messages.length >= limit);
        let nextLastId = rawResponse?.data?.nextLastId || null;
        if (!nextLastId && rawResponse?._pagination?.next_page) {
            try {
                const nextUrl = new URL(rawResponse._pagination.next_page);
                nextLastId = nextUrl.searchParams.get("id") || null;
            } catch {}
        }

        // Store fetched messages in DB for future polls (fire-and-forget)
        if (Array.isArray(messages) && messages.length > 0) {
            const rows = messages.map((m: any) => ({
                ofMessageId: String(m.id),
                creatorId,
                chatId,
                fromUserId: String(m.fromUser?.id || ""),
                isFromCreator: String(m.fromUser?.id || "") !== chatId,
                text: m.text || null,
                price: m.price || 0,
                isFree: m.isFree !== false,
                mediaCount: m.mediaCount || m.media?.length || 0,
                isLiked: m.isLiked || false,
                isTip: m.isTip || false,
                tipAmount: m.tipAmount || 0,
                raw: m,
                sentAt: new Date(m.createdAt),
            }));
            prisma.rawChatMessage.createMany({ data: rows, skipDuplicates: true }).catch(() => {});
        }

        return NextResponse.json({ messages, hasMore, nextLastId });
    } catch (e: any) {
        console.error("Inbox messages GET error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, chatId, text } = body;

        if (!creatorId || !chatId || !text) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;

        // Show typing indicator before sending
        try {
            await sendTypingIndicator(accountName, chatId, apiKey);
        } catch {} // Fire and forget

        const response = await sendChatMessage(accountName, chatId, apiKey, { text });

        return NextResponse.json({ success: true, message: response });
    } catch (e: any) {
        console.error("Inbox messages POST error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

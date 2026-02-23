import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages, sendChatMessage, sendTypingIndicator } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

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

        // OFAPI messages: { data: [...messages], _pagination: { next_page: "...?id=X" } }
        // Also handles: { data: { list: [...], hasMore, nextLastId } } (media gallery shape)
        const messages = rawResponse?.data?.list || rawResponse?.list
            || (Array.isArray(rawResponse?.data) ? rawResponse.data : null)
            || rawResponse || [];
        const hasMore = rawResponse?.data?.hasMore ?? (Array.isArray(messages) && messages.length >= limit);
        // Primary cursor: _pagination.next_page URL. Fallback: data.nextLastId
        let nextLastId = rawResponse?.data?.nextLastId || null;
        if (!nextLastId && rawResponse?._pagination?.next_page) {
            try {
                const nextUrl = new URL(rawResponse._pagination.next_page);
                nextLastId = nextUrl.searchParams.get("id") || null;
            } catch {}
        }

        return NextResponse.json({
            messages,
            hasMore,
            nextLastId,
        });
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

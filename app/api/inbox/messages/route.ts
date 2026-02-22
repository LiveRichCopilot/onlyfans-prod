import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages, sendChatMessage, sendTypingIndicator } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

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
        const rawMessages = await getChatMessages(accountName, chatId, apiKey);

        // OFAPI may return data in different shapes
        const messages = rawMessages?.list || rawMessages?.data?.list || rawMessages?.data || rawMessages || [];

        return NextResponse.json({ messages });
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

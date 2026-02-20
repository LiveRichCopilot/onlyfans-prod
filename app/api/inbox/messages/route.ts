import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages, sendChatMessage } from "@/lib/ofapi";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    const chatId = searchParams.get('chatId');

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

        const rawMessages = await getChatMessages(creator.ofapiCreatorId || creator.telegramId, chatId, apiKey);

        return NextResponse.json({ messages: rawMessages.list || rawMessages || [] });
    } catch (e: any) {
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

        // Call user's requested Typing Indicator before sending the message! (Simulates "Model is typing...")
        try {
            await fetch(`https://onlyfans-prod.vercel.app/api/inbox/typing`, { method: 'POST', body: JSON.stringify({ creatorId, chatId }) }).catch();
        } catch (e) { }

        const response = await sendChatMessage(creator.ofapiCreatorId || creator.telegramId, chatId, apiKey, { text });

        return NextResponse.json({ success: true, message: response });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

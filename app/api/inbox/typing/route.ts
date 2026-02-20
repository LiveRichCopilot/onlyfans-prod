import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTypingIndicator } from "@/lib/ofapi";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, chatId } = body;

        if (!creatorId || !chatId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
        }

        // Fire and forget to OFAPI
        await sendTypingIndicator(creator.ofapiCreatorId || creator.telegramId, chatId, apiKey);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

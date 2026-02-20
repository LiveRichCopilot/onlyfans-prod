import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listChats } from "@/lib/ofapi";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');

    if (!creatorId) return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });

    try {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
        }

        const rawChats = await listChats(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);

        // Return the raw list from OnlyFans. The frontend will map it.
        return NextResponse.json({ chats: rawChats.list || rawChats || [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

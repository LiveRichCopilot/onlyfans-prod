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

        // The true token is stored in the NextAuth Account table, not the Creator table placeholder
        const account = await prisma.account.findFirst({
            where: { providerAccountId: creator.telegramId }
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "No physical OnlyFans access token found in database for this creator." }, { status: 401 });
        }

        const realToken = account.access_token;
        const rawChats = await listChats(creator.ofapiCreatorId || creator.telegramId, realToken);

        // Return the raw list from OnlyFans. The frontend will map it.
        return NextResponse.json({ chats: rawChats.list || rawChats || [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

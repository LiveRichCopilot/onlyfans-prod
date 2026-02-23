import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllChats, listChats } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * Fetch chats from OFAPI.
 * ?creatorId=xxx — single creator
 * ?all=true — merge chats from ALL linked creators
 * ?offset=N&limit=N — incremental loading (for infinite scroll)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const fetchAll = searchParams.get("all") === "true";
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
    }

    try {
        let creatorsToFetch: any[] = [];

        if (fetchAll || !creatorId) {
            creatorsToFetch = await prisma.creator.findMany({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
            });
        } else {
            const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
            if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
                return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
            }
            creatorsToFetch = [creator];
        }

        if (creatorsToFetch.length === 0) {
            return NextResponse.json({ chats: [], hasMore: false });
        }

        // Fetch all chats (auto-paginating via _pagination.next_page) from all creators
        const results = await Promise.allSettled(
            creatorsToFetch.map(async (creator) => {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                const allChats = await fetchAllChats(accountName, apiKey, 200);
                console.log(`[CHATS] account=${accountName} fetched=${allChats.length} chats`);
                return allChats.map((chat: any) => ({
                    ...chat,
                    _creatorId: creator.id,
                    _creatorName: creator.name || creator.ofUsername || accountName,
                }));
            })
        );

        let allChats: any[] = [];
        for (const r of results) {
            if (r.status === "fulfilled") {
                allChats.push(...r.value);
            }
        }

        // Sort by last message time (most recent first)
        allChats.sort((a, b) => {
            const aTime = new Date(a.lastMessage?.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessage?.createdAt || 0).getTime();
            return bTime - aTime;
        });

        return NextResponse.json({
            chats: allChats,
            hasMore: allChats.length >= limit,
        });
    } catch (e: any) {
        console.error("Inbox chats error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

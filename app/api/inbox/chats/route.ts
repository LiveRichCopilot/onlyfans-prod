import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listChats } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * Fetch chats from OFAPI.
 * ?creatorId=xxx — single creator
 * ?all=true — merge chats from ALL linked creators
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const fetchAll = searchParams.get("all") === "true";

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
    }

    try {
        let creatorsToFetch: any[] = [];

        if (fetchAll || !creatorId) {
            // Fetch chats from ALL linked creators
            creatorsToFetch = await prisma.creator.findMany({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
            });
        } else {
            // Single creator
            const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
            if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
                return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
            }
            creatorsToFetch = [creator];
        }

        if (creatorsToFetch.length === 0) {
            return NextResponse.json({ chats: [] });
        }

        // Fetch chats from all creators in parallel
        const results = await Promise.allSettled(
            creatorsToFetch.map(async (creator) => {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                const rawChats = await listChats(accountName, apiKey);
                const chatList = rawChats?.list || rawChats?.data?.list || rawChats?.data || rawChats || [];
                // Tag each chat with the creator info so frontend knows which creator it belongs to
                return (Array.isArray(chatList) ? chatList : []).map((chat: any) => ({
                    ...chat,
                    _creatorId: creator.id,
                    _creatorName: creator.name || creator.ofUsername || accountName,
                }));
            })
        );

        // Merge all chats, sorted by most recent
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

        return NextResponse.json({ chats: allChats });
    } catch (e: any) {
        console.error("Inbox chats error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

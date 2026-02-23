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

        // Single page fetch per creator — fast initial load
        let hasMorePages = false;
        const results = await Promise.allSettled(
            creatorsToFetch.map(async (creator) => {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                const res = await listChats(accountName, apiKey, limit, offset);
                const chatList = Array.isArray(res?.data) ? res.data : [];
                const nextPage = res?._pagination?.next_page ?? res?._meta?._pagination?.next_page ?? null;
                if (nextPage) hasMorePages = true;
                return chatList.map((chat: any) => ({
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

        // Enrich chats with persistent fan data from DB (lastPurchaseAt, lifetimeSpend)
        // OFAPI chat objects may have fan data at: chat.fan.id, chat.withUser.id, or top-level chat.id
        const fanIds = allChats.map(c => {
            const id = c.fan?.id || c.withUser?.id || c.id;
            return id ? String(id) : null;
        }).filter(Boolean) as string[];

        if (fanIds.length > 0) {
            const fans = await prisma.fan.findMany({
                where: { ofapiFanId: { in: fanIds } },
                select: { ofapiFanId: true, lastPurchaseAt: true, lastPurchaseType: true, lastPurchaseAmount: true, lifetimeSpend: true },
            });
            const fanMap = new Map(fans.map(f => [f.ofapiFanId, f]));
            let matchCount = 0;
            for (const chat of allChats) {
                const fanId = String(chat.fan?.id || chat.withUser?.id || chat.id || "");
                if (fanId && fanMap.has(fanId)) {
                    const dbFan = fanMap.get(fanId)!;
                    chat._lastPurchaseAt = dbFan.lastPurchaseAt?.toISOString() || null;
                    chat._lastPurchaseType = dbFan.lastPurchaseType || null;
                    chat._lastPurchaseAmount = dbFan.lastPurchaseAmount || null;
                    if (dbFan.lifetimeSpend > 0) {
                        chat._dbLifetimeSpend = dbFan.lifetimeSpend;
                    }
                    matchCount++;
                }
            }
            console.log(`[Chats Enrichment] ${allChats.length} chats, ${fanIds.length} fan IDs extracted, ${fans.length} found in DB, ${matchCount} enriched`);
        }

        // Sort by last message time (most recent first)
        allChats.sort((a, b) => {
            const aTime = new Date(a.lastMessage?.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessage?.createdAt || 0).getTime();
            return bTime - aTime;
        });

        return NextResponse.json({
            chats: allChats,
            hasMore: hasMorePages,
        });
    } catch (e: any) {
        console.error("Inbox chats error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

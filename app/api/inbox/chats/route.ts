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
        // Auto-create Fan rows for anyone not yet in the DB
        // Use OFAPI totalSumm as authoritative lifetime spend
        const chatFanData = allChats.map(c => {
            const fan = c.fan || {};
            const id = fan.id || c.withUser?.id || c.id;
            return {
                ofapiFanId: id ? String(id) : null,
                name: fan.name || fan.displayName || c.withUser?.name || null,
                username: fan.username || c.withUser?.username || null,
                // OFAPI lifetime spend — this is the authoritative number
                totalSumm: fan.subscribedOnData?.totalSumm || 0,
                creatorId: c._creatorId || "",
            };
        }).filter(d => d.ofapiFanId);

        if (chatFanData.length > 0) {
            const fanIds = chatFanData.map(d => d.ofapiFanId!);
            const existingFans = await prisma.fan.findMany({
                where: { ofapiFanId: { in: fanIds } },
                select: { ofapiFanId: true, lastPurchaseAt: true, lastPurchaseType: true, lastPurchaseAmount: true, lifetimeSpend: true },
            });
            const fanMap = new Map(existingFans.map(f => [f.ofapiFanId, f]));

            // Auto-create missing fans in background (don't block response)
            const missingFans = chatFanData.filter(d => !fanMap.has(d.ofapiFanId!));
            if (missingFans.length > 0) {
                // Fire and forget — create placeholder Fan rows
                Promise.allSettled(
                    missingFans.map(d => prisma.fan.create({
                        data: {
                            ofapiFanId: d.ofapiFanId!,
                            creatorId: d.creatorId,
                            name: d.name,
                            username: d.username,
                            lifetimeSpend: d.totalSumm,
                        },
                    }).catch(() => {})) // Ignore dupes from race conditions
                );
                console.log(`[Chats] Auto-creating ${missingFans.length} missing fans`);
            }

            // Enrich chat objects
            let matchCount = 0;
            for (const chat of allChats) {
                const fanId = String(chat.fan?.id || chat.withUser?.id || chat.id || "");
                if (fanId && fanMap.has(fanId)) {
                    const dbFan = fanMap.get(fanId)!;
                    chat._lastPurchaseAt = dbFan.lastPurchaseAt?.toISOString() || null;
                    chat._lastPurchaseType = dbFan.lastPurchaseType || null;
                    chat._lastPurchaseAmount = dbFan.lastPurchaseAmount || null;
                    matchCount++;
                }
                // Always use OFAPI totalSumm as authoritative spend (not our partial DB)
                const ofapiSpend = chat.fan?.subscribedOnData?.totalSumm;
                if (ofapiSpend && ofapiSpend > 0) {
                    chat._dbLifetimeSpend = ofapiSpend;
                }
            }
            console.log(`[Chats Enrichment] ${allChats.length} chats, ${fanIds.length} IDs, ${existingFans.length} in DB, ${matchCount} enriched, ${missingFans.length} auto-created`);
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

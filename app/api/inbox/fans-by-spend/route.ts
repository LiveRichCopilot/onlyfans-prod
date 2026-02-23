import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listAllFans } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/fans-by-spend — List fans filtered by spend bucket
 *
 * ?creatorId=xxx (required — or "all" to merge all creators)
 * ?minSpend=100 (minimum total spend)
 * ?maxSpend=500 (optional max spend — filtered client-side since OFAPI only has min)
 * ?online=true (optional — only show online fans)
 * ?limit=50&offset=0 (pagination)
 *
 * Returns fans formatted as Chat objects so they slot into the existing fan list UI.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const minSpend = parseInt(searchParams.get("minSpend") || "0", 10);
    const maxSpend = searchParams.get("maxSpend") ? parseInt(searchParams.get("maxSpend")!, 10) : undefined;
    const online = searchParams.get("online") === "true" ? true : searchParams.get("online") === "false" ? false : undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
    }

    try {
        let creatorsToFetch: any[] = [];

        if (!creatorId || creatorId === "all") {
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
            if (creator?.ofapiToken && creator.ofapiToken !== "unlinked") {
                creatorsToFetch = [creator];
            }
        }

        if (creatorsToFetch.length === 0) {
            return NextResponse.json({ fans: [], hasMore: false, total: 0 });
        }

        // Fetch fans from OFAPI with spend filter
        let allFans: any[] = [];
        let hasMore = false;

        const results = await Promise.allSettled(
            creatorsToFetch.map(async (creator) => {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                const res = await listAllFans(accountName, apiKey, {
                    minSpend,
                    online,
                    limit,
                    offset,
                });

                const fanList: any[] = res?.data?.list || res?.data || res?.list || (Array.isArray(res) ? res : []);
                const nextPage = res?._pagination?.next_page;
                if (nextPage) hasMore = true;

                return fanList.map((fan: any) => ({
                    id: fan.id?.toString(),
                    name: fan.name || fan.displayName || "Fan",
                    username: fan.username || "",
                    avatar: fan.avatar || "",
                    totalSpend: fan.subscribedOnData?.totalSumm || fan.totalSumm || 0,
                    tipsSumm: fan.subscribedOnData?.tipsSumm || 0,
                    messagesSumm: fan.subscribedOnData?.messagesSumm || 0,
                    postsSumm: fan.subscribedOnData?.postsSumm || 0,
                    subscribesSumm: fan.subscribedOnData?.subscribesSumm || 0,
                    isOnline: fan.isOnline || false,
                    lastSeen: fan.lastSeen || null,
                    subscribedAt: fan.subscribedOnData?.subscribedOnDuration || null,
                    isExpired: fan.subscribedOnData?.expiredAt ? new Date(fan.subscribedOnData.expiredAt) < new Date() : false,
                    _creatorId: creator.id,
                    _creatorName: creator.name || creator.ofUsername || accountName,
                    _creatorAvatar: creator.avatarUrl || "",
                }));
            })
        );

        for (const r of results) {
            if (r.status === "fulfilled") allFans.push(...r.value);
        }

        // Client-side max spend filter (OFAPI only supports min)
        if (maxSpend !== undefined) {
            allFans = allFans.filter(f => f.totalSpend <= maxSpend);
        }

        // Sort by total spend descending
        allFans.sort((a, b) => b.totalSpend - a.totalSpend);

        return NextResponse.json({
            fans: allFans,
            hasMore,
            total: allFans.length,
            filter: { minSpend, maxSpend, online },
        });
    } catch (e: any) {
        console.error("Fans by spend error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

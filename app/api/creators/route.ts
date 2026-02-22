import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCreatorDashboardStats } from "@/lib/revenue";

export const dynamic = "force-dynamic";

/**
 * Dashboard creators list — all revenue from local Supabase.
 * Zero OFAPI calls. Instant response.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        const creators = await prisma.creator.findMany({
            orderBy: { createdAt: "desc" },
        });

        // If custom time range passed (from TimeRangeSelector), use those boundaries
        const hasCustomRange = startParam && endParam;

        const enrichedCreators = await Promise.all(
            creators.map(async (c: any) => {
                let hourlyRev = 0, todayRev = 0, txCount = 0;
                let topFans: { username: string; name: string; spend: number }[] = [];

                if (c.ofapiToken && c.ofapiToken !== "unlinked") {
                    if (hasCustomRange) {
                        // Custom range from TimeRangeSelector
                        const start = new Date(startParam);
                        const end = new Date(endParam);
                        const { getRevenue, getTxCount, getTopFans } = await import("@/lib/revenue");
                        const [rev, count, fans] = await Promise.all([
                            getRevenue(c.id, start, end),
                            getTxCount(c.id, start, end),
                            getTopFans(c.id, start, end, 3),
                        ]);
                        todayRev = rev;
                        txCount = count;
                        topFans = fans;
                    } else {
                        // Default: today + hourly from local DB
                        const stats = await getCreatorDashboardStats(c.id);
                        todayRev = stats.todayRev;
                        hourlyRev = stats.hourlyRev;
                        txCount = stats.txCount;
                        topFans = stats.topFans;
                    }
                }

                return {
                    ...c,
                    name: c.name || c.ofapiCreatorId || c.telegramId || "Unknown Creator",
                    handle: `@${c.ofUsername || c.ofapiCreatorId || c.telegramId}`,
                    ofUsername: c.ofUsername || null,
                    headerUrl: c.headerUrl || null,
                    hourlyRev,
                    todayRev,
                    topFans,
                    txCount,
                    target: c.hourlyTarget || 100,
                    whaleAlertTarget: c.whaleAlertTarget || 200,
                };
            })
        );

        return NextResponse.json({ creators: enrichedCreators });
    } catch (error: any) {
        console.error("Creators API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

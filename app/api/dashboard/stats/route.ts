import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    getTransactionsSummary,
    getActiveFans,
    getTransactions,
    calculateTopFans,
} from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const creators = await prisma.creator.findMany({
            where: { ofapiToken: { not: null } },
            orderBy: { createdAt: "desc" },
        });

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const creatorStats: Record<string, any> = {};
        let agencyRevenue1h = 0;
        let agencyRevenue24h = 0;
        let agencyActiveFans = 0;
        const allTopFans: { username: string; name: string; spend: number; creatorName: string }[] = [];

        // Fetch live OFAPI data for each linked creator in parallel
        const results = await Promise.allSettled(
            creators
                .filter((c) => c.ofapiToken && c.ofapiToken !== "unlinked")
                .map(async (creator) => {
                    const accountName = creator.ofapiCreatorId || creator.telegramId;
                    const apiKey = creator.ofapiToken!;

                    const payload1h = {
                        account_ids: [accountName],
                        start_date: oneHourAgo.toISOString(),
                        end_date: now.toISOString(),
                    };
                    const payload24h = {
                        account_ids: [accountName],
                        start_date: twentyFourHoursAgo.toISOString(),
                        end_date: now.toISOString(),
                    };

                    const [summary1h, summary24h, fansRes, txRes] = await Promise.all([
                        getTransactionsSummary(apiKey, payload1h, accountName).catch(() => null),
                        getTransactionsSummary(apiKey, payload24h, accountName).catch(() => null),
                        getActiveFans(accountName, apiKey).catch(() => null),
                        getTransactions(accountName, apiKey).catch(() => null),
                    ]);

                    const rev1h = parseFloat(summary1h?.data?.total_gross || summary1h?.total_gross || "0");
                    const rev24h = parseFloat(summary24h?.data?.total_gross || summary24h?.total_gross || "0");

                    // Active fans — the response shape varies, handle both array and object
                    const fansData = fansRes?.data || fansRes;
                    const fanCount = Array.isArray(fansData)
                        ? fansData.length
                        : typeof fansData?.count === "number"
                          ? fansData.count
                          : typeof fansData?.total === "number"
                            ? fansData.total
                            : 0;

                    // Top fans from raw transactions (last 24h)
                    const allTx = txRes?.data?.list || txRes?.list || txRes?.transactions || [];
                    const recentTx = allTx.filter(
                        (t: any) => new Date(t.createdAt) >= twentyFourHoursAgo
                    );
                    const topFans = calculateTopFans(recentTx, 0);

                    return {
                        creatorId: creator.id,
                        creatorName: creator.name || accountName,
                        rev1h,
                        rev24h,
                        activeFans: fanCount,
                        topFans: topFans.slice(0, 5),
                    };
                })
        );

        results.forEach((r) => {
            if (r.status === "fulfilled" && r.value) {
                const data = r.value;
                creatorStats[data.creatorId] = data;
                agencyRevenue1h += data.rev1h;
                agencyRevenue24h += data.rev24h;
                agencyActiveFans += data.activeFans;

                data.topFans.forEach((fan: any) => {
                    allTopFans.push({ ...fan, creatorName: data.creatorName });
                });
            }
        });

        // Merge and sort top fans across all creators
        const agencyTopFans = allTopFans
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 10);

        return NextResponse.json({
            agency: {
                revenue1h: agencyRevenue1h,
                revenue24h: agencyRevenue24h,
                activeFans: agencyActiveFans,
                topFans: agencyTopFans,
            },
            creators: creatorStats,
        });
    } catch (error: any) {
        console.error("Dashboard stats error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

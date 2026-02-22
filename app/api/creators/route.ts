import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionsSummary, getTransactions, calculateTopFans } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        const creators = await prisma.creator.findMany({
            orderBy: { createdAt: "desc" },
        });

        const now = endParam ? new Date(endParam) : new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const todayStart = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Fetch live revenue from OFAPI for each linked creator in parallel
        const liveDataPromises = creators
            .filter((c) => c.ofapiToken && c.ofapiToken !== "unlinked")
            .map(async (creator) => {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                const apiKey = creator.ofapiToken!;

                const payload1h = {
                    account_ids: [accountName],
                    start_date: oneHourAgo.toISOString(),
                    end_date: now.toISOString(),
                };
                const payloadToday = {
                    account_ids: [accountName],
                    start_date: todayStart.toISOString(),
                    end_date: now.toISOString(),
                };

                const [summary1h, summaryToday, txResponse] = await Promise.all([
                    getTransactionsSummary(apiKey, payload1h, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, payloadToday, accountName).catch(() => null),
                    getTransactions(accountName, apiKey).catch(() => null),
                ]);

                const hourlyRev = parseFloat(summary1h?.data?.total_gross || summary1h?.total_gross || "0");
                const todayRev = parseFloat(summaryToday?.data?.total_gross || summaryToday?.total_gross || "0");

                // Top fans from raw transactions
                const allTx = txResponse?.data?.list || txResponse?.list || txResponse?.transactions || [];
                const todayTx = allTx.filter((t: any) => new Date(t.createdAt) >= todayStart);
                const topFans = calculateTopFans(todayTx, 0).slice(0, 3);

                return {
                    creatorId: creator.id,
                    hourlyRev,
                    todayRev,
                    topFans,
                    txCount: todayTx.length,
                };
            });

        const liveResults = await Promise.allSettled(liveDataPromises);

        // Build a map of live data per creator
        const liveMap: Record<string, any> = {};
        liveResults.forEach((r) => {
            if (r.status === "fulfilled" && r.value) {
                liveMap[r.value.creatorId] = r.value;
            }
        });

        const enrichedCreators = creators.map((c: any) => {
            const live = liveMap[c.id];
            return {
                ...c,
                name: c.name || c.ofapiCreatorId || c.telegramId || "Unknown Creator",
                handle: `@${c.ofUsername || c.ofapiCreatorId || c.telegramId}`,
                ofUsername: c.ofUsername || null,
                headerUrl: c.headerUrl || null,
                hourlyRev: live?.hourlyRev || 0,
                todayRev: live?.todayRev || 0,
                topFans: live?.topFans || [],
                txCount: live?.txCount || 0,
                target: c.hourlyTarget || 100,
                whaleAlertTarget: c.whaleAlertTarget || 200,
            };
        });

        return NextResponse.json({ creators: enrichedCreators });
    } catch (error: any) {
        console.error("Creators API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

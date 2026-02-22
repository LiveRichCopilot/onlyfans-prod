import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    getTransactionsSummary,
    getTransactions,
    getEarningsByType,
    getMe,
    getTopPercentage,
    getStatisticsOverview,
    calculateTopFans,
    fetchAllTransactions,
} from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

        const stats: any = {
            todayRevenue: 0, hourlyRevenue: 0, weeklyRevenue: 0, monthlyRevenue: 0,
            activeFans: 0, subscribersCount: 0, topPercentage: "N/A",
            earningsByType: {}, overview: null, dailyChart: [],
            topFansToday: [], topFansWeek: [], topFansMonth: [],
            txCountToday: 0, avgSpendPerSpender: 0, avgSpendPerTransaction: 0,
            massMessages: { count: 0, earnings: 0 },
            newSubs: 0, visitors: 0,
        };

        if (creator.ofapiToken && creator.ofapiToken !== "unlinked") {
            const accountName = creator.ofapiCreatorId || creator.telegramId;
            const apiKey = creator.ofapiToken;
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const todayStart = new Date(now.getTime()); todayStart.setUTCHours(0, 0, 0, 0);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fmtDate = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

            try {
                const [summary1h, summaryToday, summary7d, summary30d, meRes, topPercentObj, overviewRes, tipRes, msgRes, postRes, subRes, streamRes, txRes] = await Promise.all([
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: oneHourAgo.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: todayStart.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: sevenDaysAgo.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: thirtyDaysAgo.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getMe(accountName, apiKey).catch(() => null),
                    getTopPercentage(accountName, apiKey).catch(() => null),
                    getStatisticsOverview(accountName, apiKey, fmtDate(sevenDaysAgo), fmtDate(now)).catch(() => null),
                    getEarningsByType(accountName, apiKey, "tips", fmtDate(thirtyDaysAgo), fmtDate(now)).catch(() => null),
                    getEarningsByType(accountName, apiKey, "messages", fmtDate(thirtyDaysAgo), fmtDate(now)).catch(() => null),
                    getEarningsByType(accountName, apiKey, "post", fmtDate(thirtyDaysAgo), fmtDate(now)).catch(() => null),
                    getEarningsByType(accountName, apiKey, "subscribes", fmtDate(thirtyDaysAgo), fmtDate(now)).catch(() => null),
                    getEarningsByType(accountName, apiKey, "stream", fmtDate(thirtyDaysAgo), fmtDate(now)).catch(() => null),
                    getTransactions(accountName, apiKey).catch(() => null),
                ]);

                // Revenue
                stats.hourlyRevenue = parseFloat(summary1h?.data?.total_gross || "0");
                stats.todayRevenue = parseFloat(summaryToday?.data?.total_gross || "0");
                stats.weeklyRevenue = parseFloat(summary7d?.data?.total_gross || "0");
                stats.monthlyRevenue = parseFloat(summary30d?.data?.total_gross || "0");

                // Subscriber count from /me (the real number)
                const meData = meRes?.data || meRes || {};
                stats.subscribersCount = meData.subscribersCount || meData.subscribedOnCount || 0;
                stats.activeFans = meData.subscribersCount || 0;

                // Top percentage
                stats.topPercentage = topPercentObj?.percentage || topPercentObj?.data?.percentage || "N/A";

                // Overview data (7d) — mass messages, visitors, new subs, daily chart
                const overview = overviewRes?.data || {};
                if (overview.earning?.chartData) {
                    stats.dailyChart = overview.earning.chartData.map((p: any) => ({
                        date: p.date?.substring(0, 10) || "",
                        revenue: p.count || 0,
                    }));
                }
                if (overview.massMessages) {
                    stats.massMessages = {
                        count: overview.massMessages.count?.total || 0,
                        earnings: overview.massMessages.earnings?.gross || 0,
                    };
                }
                if (overview.visitors?.subscriptions) {
                    stats.newSubs = overview.visitors.subscriptions.new?.total || 0;
                }
                stats.visitors = overview.visitors?.visitors?.total || 0;

                // Earnings by type (30d)
                const parseEarning = (res: any, key: string) => {
                    const d = res?.data?.[key] || res?.data || {};
                    return parseFloat(d.gross || d.total || "0");
                };
                stats.earningsByType = {
                    tips: parseEarning(tipRes, "tips"),
                    messages: parseEarning(msgRes, "chat_messages"),
                    posts: parseEarning(postRes, "post"),
                    subscriptions: parseEarning(subRes, "subscribes"),
                    streams: parseEarning(streamRes, "stream"),
                    massMessages: overview.massMessages?.earnings?.gross || 0,
                };

                // Top fans — today, week, month from raw transactions
                const allTx = txRes?.data?.list || txRes?.list || txRes?.transactions || [];
                const todayTx = allTx.filter((t: any) => new Date(t.createdAt) >= todayStart);
                const weekTx = allTx.filter((t: any) => new Date(t.createdAt) >= sevenDaysAgo);
                stats.topFansToday = calculateTopFans(todayTx, 0).slice(0, 5);
                stats.topFansWeek = calculateTopFans(weekTx, 0).slice(0, 5);
                stats.topFansMonth = calculateTopFans(allTx, 0).slice(0, 10);
                stats.txCountToday = todayTx.length;

                // Averages
                const todayTotal = todayTx.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
                stats.avgSpendPerTransaction = todayTx.length > 0 ? todayTotal / todayTx.length : 0;
                const spenders = stats.topFansToday.length;
                stats.avgSpendPerSpender = spenders > 0 ? stats.topFansToday.reduce((s: number, f: any) => s + f.spend, 0) / spenders : 0;

            } catch (e: any) {
                console.error(`OFAPI error for ${creator.name}: ${e.message}`);
            }
        }

        return NextResponse.json({ creator, stats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;
        const body = await request.json();
        const { whaleAlertTarget, hourlyTarget } = body;
        const updateData: any = {};
        if (whaleAlertTarget !== undefined) updateData.whaleAlertTarget = Number(whaleAlertTarget);
        if (hourlyTarget !== undefined) updateData.hourlyTarget = Number(hourlyTarget);
        const updatedCreator = await prisma.creator.update({ where: { id: creatorId }, data: updateData });
        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

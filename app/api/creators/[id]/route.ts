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
            subscribersCount: 0, topPercentage: "N/A", weeklyDelta: 0,
            earningsByType: {}, dailyChart: [],
            topFansToday: [], topFansWeek: [], topFansMonth: [],
            txCountToday: 0, avgSpendPerSpender: 0, avgSpendPerTransaction: 0,
            massMessages: { count: 0, earnings: 0 },
            newSubs: 0, visitors: 0,
        };

        if (creator.ofapiToken && creator.ofapiToken !== "unlinked") {
            const acct = creator.ofapiCreatorId || creator.telegramId;
            const key = creator.ofapiToken;
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const todayUTC = new Date(now); todayUTC.setUTCHours(0, 0, 0, 0);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

            try {
                // All parallel — 13 calls
                const [summaryToday, meRes, topPctRes, overviewRes, earningsChartRes,
                       tipRes, msgRes, postRes, subRes, streamRes, txResToday, txResWeek, txResMonth] = await Promise.all([
                    getTransactionsSummary(key, { account_ids: [acct], start_date: todayUTC.toISOString(), end_date: now.toISOString() }, acct).catch(() => null),
                    getMe(acct, key).catch(() => null),
                    getTopPercentage(acct, key).catch(() => null),
                    getStatisticsOverview(acct, key, fmt(sevenDaysAgo), fmt(now)).catch(() => null),
                    getEarningsByType(acct, key, "total", fmt(sevenDaysAgo), fmt(now)).catch(() => null),
                    getEarningsByType(acct, key, "tips", fmt(thirtyDaysAgo), fmt(now)).catch(() => null),
                    getEarningsByType(acct, key, "messages", fmt(thirtyDaysAgo), fmt(now)).catch(() => null),
                    getEarningsByType(acct, key, "post", fmt(thirtyDaysAgo), fmt(now)).catch(() => null),
                    getEarningsByType(acct, key, "subscribes", fmt(thirtyDaysAgo), fmt(now)).catch(() => null),
                    getEarningsByType(acct, key, "stream", fmt(thirtyDaysAgo), fmt(now)).catch(() => null),
                    getTransactions(acct, key).catch(() => null),
                    fetchAllTransactions(acct, key, sevenDaysAgo, 500).catch(() => []),
                    fetchAllTransactions(acct, key, thirtyDaysAgo, 2000).catch(() => []),
                ]);

                // Today revenue from transaction summary
                stats.todayRevenue = parseFloat(summaryToday?.data?.total_gross || "0");

                // Weekly + monthly from earnings endpoint (more accurate)
                const totalEarnings7d = earningsChartRes?.data?.total || {};
                stats.weeklyRevenue = totalEarnings7d.gross || 0;
                stats.weeklyDelta = totalEarnings7d.delta || 0;

                // Monthly: sum from the 30d earnings by type
                const parseEarning = (res: any, k: string) => {
                    const d = res?.data?.[k] || res?.data || {};
                    return parseFloat(d.gross || d.total || "0");
                };
                const tipVal = parseEarning(tipRes, "tips");
                const msgVal = parseEarning(msgRes, "chat_messages");
                const postVal = parseEarning(postRes, "post");
                const subVal = parseEarning(subRes, "subscribes");
                const streamVal = parseEarning(streamRes, "stream");
                stats.monthlyRevenue = tipVal + msgVal + postVal + subVal + streamVal;

                stats.earningsByType = { tips: tipVal, messages: msgVal, posts: postVal, subscriptions: subVal, streams: streamVal };

                // Chart data from earnings?type=total (7d daily bars)
                const chartAmount = totalEarnings7d.chartAmount || [];
                stats.dailyChart = chartAmount.map((p: any) => ({
                    date: p.date?.substring(0, 10) || "",
                    revenue: p.count || 0,
                })).filter((p: any) => p.date);

                // Subscriber count + profile data from /me
                const me = meRes?.data || meRes || {};
                stats.subscribersCount = me.subscribersCount || 0;

                // Top percentage — field is "top_percentage" not "percentage"
                stats.topPercentage = topPctRes?.data?.top_percentage ?? topPctRes?.percentage ?? "N/A";

                // Overview data (7d) — mass messages, visitors, new subs
                const ov = overviewRes?.data || {};
                if (ov.massMessages) {
                    stats.massMessages = { count: ov.massMessages.count?.total || 0, earnings: ov.massMessages.earnings?.gross || 0 };
                }
                stats.earningsByType.massMessages = stats.massMessages.earnings;
                stats.newSubs = ov.visitors?.subscriptions?.new?.total || 0;
                stats.visitors = ov.visitors?.visitors?.total || 0;

                // Hourly revenue — calculate from RAW transactions (not summary which caches)
                const todayTxList = txResToday?.data?.list || txResToday?.list || txResToday?.transactions || [];
                const recentTx = todayTxList.filter((t: any) => new Date(t.createdAt) >= oneHourAgo);
                stats.hourlyRevenue = recentTx.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
                stats.txCountToday = todayTxList.filter((t: any) => new Date(t.createdAt) >= todayUTC).length;

                // Top fans — today from latest 100, week/month from paginated fetches
                const todayTx = todayTxList.filter((t: any) => new Date(t.createdAt) >= todayUTC);
                stats.topFansToday = calculateTopFans(todayTx, 0).slice(0, 5);

                const weekTx = Array.isArray(txResWeek) ? txResWeek : [];
                stats.topFansWeek = calculateTopFans(weekTx, 0).slice(0, 5);

                const monthTx = Array.isArray(txResMonth) ? txResMonth : [];
                stats.topFansMonth = calculateTopFans(monthTx, 0).slice(0, 10);

                // Averages (today)
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

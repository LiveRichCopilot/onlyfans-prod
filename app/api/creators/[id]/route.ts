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

/**
 * Creator profile stats — LIVE from OFAPI.
 * Revenue, top fans, earnings by type, chart all pulled fresh.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

        const stats: any = {
            todayRevenue: 0, yesterdayRevenue: 0, hourlyRevenue: 0, weeklyRevenue: 0, monthlyRevenue: 0,
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
            // UK midnight boundaries (consistent with dashboard /api/creators)
            const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
            const todayStartUk = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), 0, 0, 0, 0);
            const ukOffset = ukNow.getTime() - now.getTime();
            const todayUTC = new Date(todayStartUk.getTime() - ukOffset);
            const yesterdayUTC = new Date(todayUTC.getTime() - 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

            try {
                // All parallel — 14 calls
                const [summaryToday, summaryYesterday, meRes, topPctRes, overviewRes, earningsChartRes,
                       tipRes, msgRes, postRes, subRes, streamRes, txResToday, txResWeek, txResMonth] = await Promise.all([
                    getTransactionsSummary(key, { account_ids: [acct], start_date: todayUTC.toISOString(), end_date: now.toISOString() }, acct).catch(() => null),
                    getTransactionsSummary(key, { account_ids: [acct], start_date: yesterdayUTC.toISOString(), end_date: todayUTC.toISOString() }, acct).catch(() => null),
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
                stats.yesterdayRevenue = parseFloat(summaryYesterday?.data?.total_gross || "0");

                // Weekly + monthly from earnings endpoint
                const totalEarnings7d = earningsChartRes?.data?.total || {};
                stats.weeklyRevenue = totalEarnings7d.gross || 0;
                stats.weeklyDelta = totalEarnings7d.delta || 0;

                // Monthly: sum from 30d earnings by type
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

                // Chart data (7d daily bars)
                const chartAmount = totalEarnings7d.chartAmount || [];
                stats.dailyChart = chartAmount.map((p: any) => ({
                    date: p.date?.substring(0, 10) || "",
                    revenue: p.count || 0,
                })).filter((p: any) => p.date);

                // Subscriber count from /me
                const me = meRes?.data || meRes || {};
                stats.subscribersCount = me.subscribersCount || 0;

                // Top percentage
                stats.topPercentage = topPctRes?.data?.top_percentage ?? topPctRes?.percentage ?? "N/A";

                // Overview (7d) — mass messages, visitors, new subs
                const ov = overviewRes?.data || {};
                if (ov.massMessages) {
                    stats.massMessages = { count: ov.massMessages.count?.total || 0, earnings: ov.massMessages.earnings?.gross || 0 };
                }
                stats.earningsByType.massMessages = stats.massMessages.earnings;
                stats.newSubs = ov.visitors?.subscriptions?.new?.total || 0;
                stats.visitors = ov.visitors?.visitors?.total || 0;

                // Hourly revenue from RAW transactions (not summary)
                const todayTxList = txResToday?.data?.list || txResToday?.list || txResToday?.transactions || [];
                const recentTx = todayTxList.filter((t: any) => new Date(t.createdAt) >= oneHourAgo);
                stats.hourlyRevenue = recentTx.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
                stats.txCountToday = todayTxList.filter((t: any) => new Date(t.createdAt) >= todayUTC).length;

                // Top fans — today, week, month
                const todayTx = todayTxList.filter((t: any) => new Date(t.createdAt) >= todayUTC);
                stats.topFansToday = calculateTopFans(todayTx, 0).slice(0, 5);
                stats.topFans = stats.topFansToday; // Alias for StatsGrid

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
        const { action, whaleAlertTarget, hourlyTarget, purchaseAlertsEnabled } = body;

        // --- Action: Disconnect (DELETE from OFAPI + clear DB so user can re-auth) ---
        if (action === "disconnect") {
            const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
            if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

            const apiKey = process.env.OFAPI_API_KEY;
            const OFAPI_BASE = "https://app.onlyfansapi.com";

            // If creator has a real acct_ ID, disconnect from OFAPI first
            if (apiKey && creator.ofapiCreatorId?.startsWith("acct_")) {
                try {
                    const delRes = await fetch(`${OFAPI_BASE}/api/accounts/${creator.ofapiCreatorId}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    console.log(`[Disconnect] OFAPI DELETE /api/accounts/${creator.ofapiCreatorId}: ${delRes.status}`);
                } catch (e: any) {
                    console.error(`[Disconnect] OFAPI DELETE failed:`, e.message);
                    // Continue anyway — clear DB even if OFAPI call fails
                }
            }

            // Clear DB linkage so Connect OF button reappears
            const updatedCreator = await prisma.creator.update({
                where: { id: creatorId },
                data: {
                    ofapiToken: "unlinked",
                    ofapiCreatorId: null,
                    avatarUrl: null,
                    headerUrl: null,
                },
            });
            return NextResponse.json({ success: true, creator: updatedCreator });
        }

        // --- Action: Re-authenticate (refresh OFAPI session without full disconnect) ---
        if (action === "reauthenticate") {
            const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
            if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

            const apiKey = process.env.OFAPI_API_KEY;
            if (!apiKey) return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });

            const acctId = creator.ofapiCreatorId;
            if (!acctId?.startsWith("acct_")) {
                return NextResponse.json({
                    success: false,
                    error: "No valid OFAPI account ID — use Disconnect & Reconnect instead",
                }, { status: 400 });
            }

            const OFAPI_BASE = "https://app.onlyfansapi.com";
            try {
                const reauthRes = await fetch(`${OFAPI_BASE}/api/authenticate/${acctId}/reauthenticate`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${apiKey}` },
                });
                const reauthData = await reauthRes.json().catch(() => null);

                if (!reauthRes.ok) {
                    return NextResponse.json({
                        success: false,
                        error: `Re-authenticate failed: ${reauthRes.status}`,
                        details: reauthData,
                    }, { status: reauthRes.status });
                }

                return NextResponse.json({ success: true, reauthenticated: acctId, response: reauthData });
            } catch (e: any) {
                return NextResponse.json({ success: false, error: e.message }, { status: 500 });
            }
        }

        // --- Action: Force re-sync profile from OFAPI ---
        if (action === "force-sync") {
            const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
            if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

            const apiKey = process.env.OFAPI_API_KEY;
            if (!apiKey) return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });

            const OFAPI_BASE = "https://app.onlyfansapi.com";
            const accountsRes = await fetch(`${OFAPI_BASE}/api/accounts`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!accountsRes.ok) return NextResponse.json({ error: "OFAPI accounts fetch failed" }, { status: 502 });

            const accounts = await accountsRes.json();
            const accountList = Array.isArray(accounts) ? accounts : accounts?.data || [];

            // Match by acct_ ID, username, or display name
            const key = creator.ofapiCreatorId ?? creator.ofUsername;
            const isAcctId = key?.startsWith("acct_");
            const match = accountList.find((a: any) =>
                isAcctId
                    ? a.id === key
                    : (a.onlyfans_username === key ||
                       a.onlyfans_username === creator.ofUsername ||
                       a.display_name === key)
            );

            if (!match) {
                return NextResponse.json({
                    success: false,
                    error: `No OFAPI match for "${key}". Available accounts: ${accountList.map((a: any) => a.onlyfans_username || a.id).join(", ")}`,
                    availableAccounts: accountList.map((a: any) => ({
                        id: a.id,
                        username: a.onlyfans_username,
                        displayName: a.display_name,
                    })),
                }, { status: 404 });
            }

            const userData = match.onlyfans_user_data || {};
            const updateData: any = {
                ofapiToken: "linked_via_auth_module",
                ofapiCreatorId: match.id,
            };

            const displayName = userData.name || match.display_name;
            if (displayName) updateData.name = displayName;
            const username = match.onlyfans_username || userData.username;
            if (username) updateData.ofUsername = username;

            let avatar = userData.avatar || userData.avatarUrl;
            let header = userData.header || userData.headerUrl || userData.header_image;

            // Fallback to /me endpoint for avatar/header
            if (!avatar || !header) {
                try {
                    const meRes = await fetch(`${OFAPI_BASE}/api/${match.id}/me`, {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    if (meRes.ok) {
                        const me = await meRes.json();
                        if (!avatar) avatar = me.avatar || me.avatarUrl;
                        if (!header) header = me.header || me.headerUrl || me.header_image || me.headerSize?.url;
                        if (!updateData.name && me.name) updateData.name = me.name;
                    }
                } catch {}
            }

            if (avatar) updateData.avatarUrl = avatar;
            if (header) updateData.headerUrl = header;

            const updatedCreator = await prisma.creator.update({
                where: { id: creatorId },
                data: updateData,
            });

            return NextResponse.json({ success: true, creator: updatedCreator, matched: match.id });
        }

        // --- Default: update thresholds ---
        const updateData: any = {};
        if (whaleAlertTarget !== undefined) updateData.whaleAlertTarget = Number(whaleAlertTarget);
        if (hourlyTarget !== undefined) updateData.hourlyTarget = Number(hourlyTarget);
        if (purchaseAlertsEnabled !== undefined) updateData.purchaseAlertsEnabled = Boolean(purchaseAlertsEnabled);
        const updatedCreator = await prisma.creator.update({ where: { id: creatorId }, data: updateData });
        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

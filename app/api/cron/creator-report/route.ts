import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    getEarningsOverview,
    getMe,
    getTopPercentage,
    getStatisticsOverview,
    getTransactionsSummary,
} from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const parseNum = (v: any): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
};

/**
 * Creator Daily Report Cron — matches HistoricalSalesUTC0 spreadsheet (29 columns)
 *
 * Runs daily at 06:00 UTC. For each connected creator, pulls yesterday's
 * earnings + audience metrics from OFAPI and stores a full snapshot.
 *
 * 5 OFAPI calls per creator:
 *   1. getEarningsOverview — full earnings breakdown
 *   2. getTransactionsSummary — totals + refund data
 *   3. getMe — subscribersCount, followingCount
 *   4. getTopPercentage — OF ranking
 *   5. getStatisticsOverview — new subs, active fans, renew data, visitors
 *
 * Supports ?backfill=true&days=30 for historical backfill.
 * Supports ?creatorId=xxx to run for a single creator.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const globalApiKey = process.env.OFAPI_API_KEY;
    if (!globalApiKey) {
        return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
    }

    const startTime = Date.now();
    const url = new URL(req.url);
    const backfill = url.searchParams.get("backfill") === "true";
    const backfillDays = Math.min(parseInt(url.searchParams.get("days") || "7"), 90);
    const forceCreatorId = url.searchParams.get("creatorId");

    try {
        // Get all linked creators
        let creators;
        if (forceCreatorId) {
            const c = await prisma.creator.findUnique({ where: { id: forceCreatorId } });
            creators = c ? [c] : [];
        } else {
            creators = await prisma.creator.findMany({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
            });
        }

        if (creators.length === 0) {
            return NextResponse.json({ status: "no_creators_to_report" });
        }

        // Build date range(s) to process
        const datesToProcess: Date[] = [];
        if (backfill) {
            for (let i = backfillDays; i >= 1; i--) {
                const d = new Date();
                d.setUTCHours(0, 0, 0, 0);
                d.setUTCDate(d.getUTCDate() - i);
                datesToProcess.push(d);
            }
        } else {
            const yesterday = new Date();
            yesterday.setUTCHours(0, 0, 0, 0);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            datesToProcess.push(yesterday);
        }

        const allResults: any[] = [];

        for (const creator of creators) {
            if (!creator.ofapiToken || creator.ofapiToken === "unlinked") continue;

            // Only use real OFAPI account IDs — never fall back to telegramId
            const acct = creator.ofapiCreatorId;
            if (!acct) {
                allResults.push({
                    creator: creator.name || creator.id,
                    error: "missing_ofapiCreatorId",
                    ok: false,
                });
                continue;
            }

            const key = creator.ofapiToken;

            for (const reportDate of datesToProcess) {
                const result: any = {
                    creator: creator.name || acct,
                    date: reportDate.toISOString().slice(0, 10),
                    ok: false,
                };

                try {
                    const dayStart = reportDate.toISOString();
                    const dayEnd = new Date(reportDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
                    const fmt = (d: string) => d.replace("T", " ").replace(/\.\d+Z$/, "");

                    // 5 calls in parallel
                    const [earningsRes, txSummaryRes, meRes, topPctRes, overviewRes] = await Promise.all([
                        getEarningsOverview(key, {
                            account_ids: [acct],
                            start_date: dayStart,
                            end_date: dayEnd,
                        }, acct).catch(() => null),
                        getTransactionsSummary(key, {
                            account_ids: [acct],
                            start_date: dayStart,
                            end_date: dayEnd,
                        }, acct).catch(() => null),
                        getMe(acct, key).catch(() => null),
                        getTopPercentage(acct, key).catch(() => null),
                        getStatisticsOverview(acct, key, fmt(dayStart), fmt(dayEnd)).catch(() => null),
                    ]);

                    // ---- Parse earnings (from getEarningsOverview) ----
                    const ed = earningsRes?.data || earningsRes || {};

                    const totalGross = parseNum(ed.total_earnings || ed.total_gross || ed.total);
                    const subsGross = parseNum(ed.subscriptions || ed.subscribes || ed.subs);
                    const messagesGross = parseNum(ed.messages || ed.chat_messages);
                    const postsGross = parseNum(ed.posts || ed.post);
                    const streamsGross = parseNum(ed.streams || ed.stream);
                    const tipsGross =
                        parseNum(ed.tips) +
                        parseNum(ed.tips_posts) +
                        parseNum(ed.tips_messages);

                    // ---- Parse transaction summary (refunds, net) ----
                    const txd = txSummaryRes?.data || txSummaryRes || {};
                    const refundGross = parseNum(txd.total_refunds || txd.refunds || txd.chargebacks);
                    const totalNet = txd.total_net != null ? parseNum(txd.total_net) : null;

                    // ---- Parse audience from /me ----
                    const me = meRes?.data || meRes || {};
                    const subscribersCount = parseNum(me.subscribersCount || me.subscribers_count);
                    const followingCount = parseNum(me.followingCount || me.following_count);

                    // ---- Parse top percentage ----
                    const topPct = topPctRes?.data?.top_percentage ?? topPctRes?.percentage ?? null;
                    const topPercentage = topPct !== null && topPct !== undefined
                        ? (Number.isFinite(parseFloat(String(topPct))) ? parseFloat(String(topPct)) : null)
                        : null;

                    // ---- Parse statistics overview (fans, subs, visitors) ----
                    const ov = overviewRes?.data || {};
                    const newSubs = parseNum(
                        ov.visitors?.subscriptions?.new?.total ||
                        ov.subscribers?.new?.total ||
                        ov.newSubscribers
                    );
                    const activeFans = parseNum(
                        ov.visitors?.subscriptions?.active?.total ||
                        ov.subscribers?.active?.total ||
                        ov.activeSubscribers ||
                        me.subscribersCount || me.subscribers_count
                    );
                    const fansRenewOn = parseNum(
                        ov.visitors?.subscriptions?.renew_on?.total ||
                        ov.subscribers?.renew_on?.total ||
                        ov.renewOn
                    );

                    // New vs recurring sub revenue
                    const newSubsGross = parseNum(
                        ed.new_subscriptions || ed.subscriptions_new || ov.earnings?.subscriptions?.new?.gross
                    );
                    const recurringSubsGross = newSubsGross > 0
                        ? Math.max(0, subsGross - newSubsGross)
                        : 0;

                    // Averages from transaction summary or overview
                    const avgSpendPerSpender = parseNum(
                        txd.avg_spend_per_spender || txd.average_per_spender
                    );
                    const avgSpendPerTransaction = parseNum(
                        txd.avg_spend_per_transaction || txd.average_per_transaction
                    );
                    const avgEarningsPerFan = activeFans > 0
                        ? Math.round((totalGross / activeFans) * 100) / 100
                        : 0;
                    const avgSubLength = parseNum(
                        ov.visitors?.subscriptions?.avg_length?.total ||
                        ov.subscribers?.avg_length ||
                        ov.averageSubscriptionLength
                    );

                    // Day-over-day expired fan change (look up previous day)
                    let expiredFanChange = 0;
                    try {
                        const prevDate = new Date(reportDate.getTime() - 24 * 60 * 60 * 1000);
                        const prevReport = await prisma.creatorDailyReport.findUnique({
                            where: { creatorId_date: { creatorId: creator.id, date: prevDate } },
                            select: { subscribersCount: true },
                        });
                        if (prevReport) {
                            // If subs went down but we got new subs, the difference + newSubs = expired
                            const subsDelta = Math.round(subscribersCount) - prevReport.subscribersCount;
                            expiredFanChange = subsDelta < 0 ? subsDelta : -(Math.round(newSubs) - subsDelta);
                            if (!Number.isFinite(expiredFanChange)) expiredFanChange = 0;
                        }
                    } catch {}

                    // ---- Upsert into DB ----
                    const reportData = {
                        totalGross,
                        totalNet,
                        subsGross,
                        newSubsGross,
                        recurringSubsGross,
                        tipsGross,
                        messagesGross,
                        postsGross,
                        streamsGross,
                        refundGross,
                        subscribersCount: Math.round(subscribersCount),
                        followingCount: Math.round(followingCount),
                        topPercentage,
                        newSubs: Math.round(newSubs),
                        activeFans: Math.round(activeFans),
                        fansRenewOn: Math.round(fansRenewOn),
                        expiredFanChange,
                        avgSpendPerSpender,
                        avgSpendPerTransaction,
                        avgEarningsPerFan,
                        avgSubLength,
                        earningsJson: earningsRes ?? Prisma.DbNull,
                        overviewJson: overviewRes ?? Prisma.DbNull,
                    };

                    await prisma.creatorDailyReport.upsert({
                        where: {
                            creatorId_date: {
                                creatorId: creator.id,
                                date: reportDate,
                            },
                        },
                        create: { creatorId: creator.id, date: reportDate, ...reportData },
                        update: reportData,
                    });

                    result.ok = true;
                    result.totalGross = totalGross;
                    result.subscribersCount = Math.round(subscribersCount);
                    result.topPercentage = topPercentage;
                    result.newSubs = Math.round(newSubs);
                    result.activeFans = Math.round(activeFans);
                } catch (e: any) {
                    result.error = e.message;
                    console.error(`[Creator Report] ${result.creator} ${result.date}: ${e.message}`);
                }

                allResults.push(result);
            }

            // Time guard — respect Vercel limits
            if (Date.now() - startTime > 100000) {
                console.log(`[Creator Report] Time limit reached after ${allResults.length} reports`);
                break;
            }
        }

        return NextResponse.json({
            status: "ok",
            mode: backfill ? `backfill_${backfillDays}d` : "daily",
            reportsCreated: allResults.filter((r) => r.ok).length,
            totalAttempted: allResults.length,
            durationMs: Date.now() - startTime,
            results: allResults,
        });
    } catch (err: any) {
        console.error("[Creator Report] Fatal:", err.message);
        return NextResponse.json(
            { error: err.message, durationMs: Date.now() - startTime },
            { status: 500 }
        );
    }
}

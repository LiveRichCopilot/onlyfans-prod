import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    getEarningsByType,
    getMe,
    getTopPercentage,
    getStatisticsOverview,
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
                    // OFAPI date format: "2026-02-27 00:00:00" (NOT ISO with T/Z)
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const y = reportDate.getUTCFullYear();
                    const m = pad(reportDate.getUTCMonth() + 1);
                    const d = pad(reportDate.getUTCDate());
                    const dayStart = `${y}-${m}-${d} 00:00:00`;
                    const dayEnd = `${y}-${m}-${d} 23:59:59`;

                    // ---- 6 earnings calls (per type) + /me + top% + overview (best-effort) ----
                    const [
                        totalRes, subsRes, tipsRes, postsRes, msgsRes, streamsRes,
                        meRes, topPctRes, overviewRes,
                    ] = await Promise.all([
                        getEarningsByType(acct, key, "total", dayStart, dayEnd).catch(() => null),
                        getEarningsByType(acct, key, "subscribes", dayStart, dayEnd).catch(() => null),
                        getEarningsByType(acct, key, "tips", dayStart, dayEnd).catch(() => null),
                        getEarningsByType(acct, key, "post", dayStart, dayEnd).catch(() => null),
                        getEarningsByType(acct, key, "messages", dayStart, dayEnd).catch(() => null),
                        getEarningsByType(acct, key, "stream", dayStart, dayEnd).catch(() => null),
                        getMe(acct, key).catch(() => null),
                        getTopPercentage(acct, key).catch(() => null),
                        // Best-effort: may return data or null depending on OFAPI plan
                        getStatisticsOverview(acct, key, dayStart, dayEnd).catch(() => null),
                    ]);

                    // ---- Parse earnings (OFAPI confirmed: individual per-type GET calls) ----
                    const parseGross = (res: any): number => {
                        if (!res) return 0;
                        const d = res?.data || res;
                        // Response may be { gross: X }, { total: X }, { amount: X }, or a number
                        if (typeof d === "number") return d;
                        return parseNum(d?.gross ?? d?.total ?? d?.amount ?? d?.earnings ?? d?.sum ?? 0);
                    };

                    const totalGross = parseGross(totalRes);
                    const subsGross = parseGross(subsRes);
                    const tipsGross = parseGross(tipsRes);
                    const postsGross = parseGross(postsRes);
                    const messagesGross = parseGross(msgsRes);
                    const streamsGross = parseGross(streamsRes);

                    // ---- Calculate from our own Transaction table ----
                    const localTxStats: { refunds: number; avgPerSpender: number; avgPerTx: number; txCount: number }[] =
                        await prisma.$queryRaw`
                            SELECT
                                COALESCE(ABS(SUM(CASE WHEN "amount" < 0 THEN "amount" ELSE 0 END)), 0) as "refunds",
                                CASE WHEN COUNT(DISTINCT CASE WHEN "amount" > 0 THEN "fanId" END) > 0
                                    THEN SUM(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END)::float
                                         / COUNT(DISTINCT CASE WHEN "amount" > 0 THEN "fanId" END)
                                    ELSE 0 END as "avgPerSpender",
                                CASE WHEN COUNT(CASE WHEN "amount" > 0 THEN 1 END) > 0
                                    THEN SUM(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END)::float
                                         / COUNT(CASE WHEN "amount" > 0 THEN 1 END)
                                    ELSE 0 END as "avgPerTx",
                                COUNT(*)::int as "txCount"
                            FROM "Transaction"
                            WHERE "creatorId" = ${creator.id}
                              AND "date" >= ${reportDate}
                              AND "date" < ${new Date(reportDate.getTime() + 24 * 60 * 60 * 1000)}
                        `;
                    const localTx = localTxStats[0] || { refunds: 0, avgPerSpender: 0, avgPerTx: 0, txCount: 0 };

                    const refundGross = Number(localTx.refunds) || 0;
                    const totalNet = totalGross > 0 ? totalGross - refundGross : null;
                    const avgSpendPerSpender = Math.round((Number(localTx.avgPerSpender) || 0) * 100) / 100;
                    const avgSpendPerTransaction = Math.round((Number(localTx.avgPerTx) || 0) * 100) / 100;

                    // ---- Parse audience from /me (works if it works) ----
                    const me = meRes?.data || meRes || {};
                    const subscribersCount = parseNum(me.subscribersCount || me.subscribers_count);
                    const followingCount = parseNum(me.followingCount || me.following_count);

                    // ---- Parse top percentage (works if it works) ----
                    const topPct = topPctRes?.data?.top_percentage ?? topPctRes?.percentage ?? null;
                    const topPercentage = topPct !== null && topPct !== undefined
                        ? (Number.isFinite(parseFloat(String(topPct))) ? parseFloat(String(topPct)) : null)
                        : null;

                    // ---- Parse statistics overview (best-effort — may return 0) ----
                    const ov = overviewRes?.data || {};
                    const newSubs = parseNum(
                        ov.visitors?.subscriptions?.new?.total ||
                        ov.subscribers?.new?.total ||
                        ov.newSubscribers
                    );
                    const activeFans = parseNum(
                        ov.visitors?.subscriptions?.active?.total ||
                        ov.subscribers?.active?.total ||
                        ov.activeSubscribers
                    ) || Math.round(subscribersCount); // fallback to subscriber count
                    const fansRenewOn = parseNum(
                        ov.visitors?.subscriptions?.renew_on?.total ||
                        ov.subscribers?.renew_on?.total ||
                        ov.renewOn
                    );

                    // New vs recurring sub revenue (best-effort from overview, may be 0)
                    const newSubsGross = parseNum(
                        ov.earnings?.subscriptions?.new?.gross
                    );
                    const recurringSubsGross = newSubsGross > 0
                        ? Math.max(0, subsGross - newSubsGross)
                        : 0;

                    // Avg earnings per fan (calculated)
                    const avgEarningsPerFan = activeFans > 0
                        ? Math.round((totalGross / activeFans) * 100) / 100
                        : 0;

                    // Avg sub length (best-effort from OFAPI, may be 0)
                    const avgSubLength = parseNum(
                        ov.visitors?.subscriptions?.avg_length?.total ||
                        ov.subscribers?.avg_length ||
                        ov.averageSubscriptionLength
                    );

                    // Day-over-day expired fan change
                    let expiredFanChange = 0;
                    try {
                        const prevDate = new Date(reportDate.getTime() - 24 * 60 * 60 * 1000);
                        const prevReport = await prisma.creatorDailyReport.findUnique({
                            where: { creatorId_date: { creatorId: creator.id, date: prevDate } },
                            select: { subscribersCount: true },
                        });
                        if (prevReport) {
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
                        earningsJson: { total: totalRes, subscribes: subsRes, tips: tipsRes, post: postsRes, messages: msgsRes, stream: streamsRes },
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEarningsOverview, getMe, getTopPercentage } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const parseNum = (v: any): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
};

/**
 * Creator Daily Report Cron
 *
 * Runs daily at 06:00 UTC. For each connected creator, pulls yesterday's
 * earnings from OFAPI and stores a snapshot row in CreatorDailyReport.
 *
 * 3 OFAPI calls per creator:
 *   1. getEarningsOverview (POST /api/analytics/summary/earnings) — full breakdown
 *   2. getMe (GET /api/{acct}/me) — subscribersCount, followingCount
 *   3. getTopPercentage (GET /api/{acct}/me/top-percentage) — ranking
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

                    // 3 calls in parallel
                    const [earningsRes, meRes, topPctRes] = await Promise.all([
                        getEarningsOverview(key, {
                            account_ids: [acct],
                            start_date: dayStart,
                            end_date: dayEnd,
                        }, acct).catch(() => null),
                        getMe(acct, key).catch(() => null),
                        getTopPercentage(acct, key).catch(() => null),
                    ]);

                    // Parse earnings — map known OFAPI response fields
                    const ed = earningsRes?.data || earningsRes || {};

                    const totalGross = parseNum(ed.total_earnings || ed.total_gross || ed.total);
                    const subsGross = parseNum(ed.subscriptions || ed.subscribes || ed.subs);
                    const messagesGross = parseNum(ed.messages || ed.chat_messages);
                    const postsGross = parseNum(ed.posts || ed.post);
                    const streamsGross = parseNum(ed.streams || ed.stream);
                    // Tips may be split into tips_posts + tips_messages in OFAPI response
                    const tipsGross =
                        parseNum(ed.tips) +
                        parseNum(ed.tips_posts) +
                        parseNum(ed.tips_messages);

                    // Parse audience from /me
                    const me = meRes?.data || meRes || {};
                    const subscribersCount = parseNum(me.subscribersCount || me.subscribers_count);
                    const followingCount = parseNum(me.followingCount || me.following_count);

                    // Parse top percentage
                    const topPct = topPctRes?.data?.top_percentage ?? topPctRes?.percentage ?? null;
                    const topPercentage = topPct !== null && topPct !== undefined
                        ? (Number.isFinite(parseFloat(String(topPct))) ? parseFloat(String(topPct)) : null)
                        : null;

                    // Upsert into DB
                    await prisma.creatorDailyReport.upsert({
                        where: {
                            creatorId_date: {
                                creatorId: creator.id,
                                date: reportDate,
                            },
                        },
                        create: {
                            creatorId: creator.id,
                            date: reportDate,
                            totalGross,
                            totalNet: null,
                            subsGross,
                            tipsGross,
                            messagesGross,
                            postsGross,
                            streamsGross,
                            subscribersCount: Math.round(subscribersCount),
                            followingCount: Math.round(followingCount),
                            topPercentage,
                            newSubs: 0,
                            earningsJson: earningsRes || null,
                            overviewJson: null,
                        },
                        update: {
                            totalGross,
                            totalNet: null,
                            subsGross,
                            tipsGross,
                            messagesGross,
                            postsGross,
                            streamsGross,
                            subscribersCount: Math.round(subscribersCount),
                            followingCount: Math.round(followingCount),
                            topPercentage,
                            earningsJson: earningsRes || null,
                            overviewJson: null,
                        },
                    });

                    result.ok = true;
                    result.totalGross = totalGross;
                    result.subscribersCount = Math.round(subscribersCount);
                    result.topPercentage = topPercentage;
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

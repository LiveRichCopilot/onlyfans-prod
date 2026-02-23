import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHUNK_SIZE = 100;

/**
 * GET /api/cron/stage-decay — Daily lifecycle stage decay + computed fields
 *
 * Runs daily at 6 AM UTC via Vercel Cron.
 * 1. Transitions fan stages based on days since last purchase
 * 2. Computes timeWasterScore for recently active fans
 * 3. Sets nextBestAction based on stage + spend + recency
 */
export async function GET(req: NextRequest) {
    // Auth guard (skip in dev)
    if (process.env.NODE_ENV === "production") {
        const authHeader = req.headers.get("Authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    const startTime = Date.now();
    const now = new Date();
    const summary = {
        stageChanges: 0,
        timeWasterScoresUpdated: 0,
        nextBestActionsUpdated: 0,
        errors: [] as string[],
    };

    try {
        // --- 1. Stage Decay ---
        const fansWithStage = await prisma.fan.findMany({
            where: {
                stage: { in: ["active_buyer", "cooling_off", "at_risk", "warming", "reactivated"] },
            },
            select: {
                id: true,
                stage: true,
                lastPurchaseAt: true,
                lifetimeSpend: true,
            },
        });

        const stageUpdates: { id: string; newStage: string; oldStage: string; reason: string }[] = [];

        for (const fan of fansWithStage) {
            const daysSinceLastPurchase = fan.lastPurchaseAt
                ? Math.floor((now.getTime() - fan.lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24))
                : Infinity;

            let newStage: string | null = null;
            let reason = "";

            switch (fan.stage) {
                case "active_buyer":
                    if (daysSinceLastPurchase >= 14) {
                        newStage = "cooling_off";
                        reason = `No purchase in ${daysSinceLastPurchase} days (threshold: 14)`;
                    }
                    break;
                case "cooling_off":
                    if (daysSinceLastPurchase >= 30) {
                        newStage = "at_risk";
                        reason = `No purchase in ${daysSinceLastPurchase} days (threshold: 30)`;
                    }
                    break;
                case "at_risk":
                    if (daysSinceLastPurchase >= 60) {
                        newStage = "churned";
                        reason = `No purchase in ${daysSinceLastPurchase} days (threshold: 60)`;
                    }
                    break;
                case "warming":
                    if (daysSinceLastPurchase >= 14) {
                        newStage = "cooling_off";
                        reason = `No purchase in ${daysSinceLastPurchase} days (threshold: 14)`;
                    }
                    break;
                case "reactivated":
                    if (daysSinceLastPurchase >= 14) {
                        newStage = "cooling_off";
                        reason = `Reactivated fan went quiet — no purchase in ${daysSinceLastPurchase} days`;
                    }
                    break;
            }

            if (newStage) {
                stageUpdates.push({ id: fan.id, newStage, oldStage: fan.stage!, reason });
            }
        }

        // Check reactivated fans for promotion to active_buyer (3+ purchases in last 30 days)
        const reactivatedFans = fansWithStage.filter(f => f.stage === "reactivated");
        if (reactivatedFans.length > 0) {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const reactivatedIds = reactivatedFans.map(f => f.id);

            // Count recent transactions per reactivated fan
            const txCounts = await prisma.transaction.groupBy({
                by: ["fanId"],
                where: {
                    fanId: { in: reactivatedIds },
                    date: { gte: thirtyDaysAgo },
                },
                _count: { id: true },
            });

            const txCountMap = new Map(txCounts.map(t => [t.fanId, t._count.id]));

            for (const fan of reactivatedFans) {
                const recentTxCount = txCountMap.get(fan.id) || 0;
                // Only promote if not already marked for cooling_off and has 3+ purchases
                const alreadyMarked = stageUpdates.some(u => u.id === fan.id);
                if (!alreadyMarked && recentTxCount >= 3) {
                    stageUpdates.push({
                        id: fan.id,
                        newStage: "active_buyer",
                        oldStage: "reactivated",
                        reason: `${recentTxCount} purchases in last 30 days (threshold: 3)`,
                    });
                }
            }
        }

        // Apply stage changes in chunks
        for (let i = 0; i < stageUpdates.length; i += CHUNK_SIZE) {
            const chunk = stageUpdates.slice(i, i + CHUNK_SIZE);
            await Promise.all(
                chunk.map(({ id, newStage, oldStage, reason }) =>
                    prisma.$transaction([
                        prisma.fan.update({
                            where: { id },
                            data: { stage: newStage, stageUpdatedAt: now },
                        }),
                        prisma.fanLifecycleEvent.create({
                            data: {
                                fanId: id,
                                type: "stage_change",
                                metadata: { from: oldStage, to: newStage, reason },
                            },
                        }),
                    ])
                )
            );
            summary.stageChanges += chunk.length;
        }

        // --- 2. Time Waster Score ---
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentlyActiveFans = await prisma.fan.findMany({
            where: {
                lastMessageAt: { gte: thirtyDaysAgo },
            },
            select: {
                id: true,
                lastPurchaseAt: true,
                lifetimeSpend: true,
            },
        });

        for (let i = 0; i < recentlyActiveFans.length; i += CHUNK_SIZE) {
            const chunk = recentlyActiveFans.slice(i, i + CHUNK_SIZE);
            await Promise.all(
                chunk.map((fan) => {
                    const daysSinceLastPurchase = fan.lastPurchaseAt
                        ? Math.floor((now.getTime() - fan.lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24))
                        : 90; // Default high if never purchased
                    const spend = fan.lifetimeSpend || 0;
                    const score = Math.min(100, Math.max(0, (daysSinceLastPurchase * 2) - (spend / 10)));
                    return prisma.fan.update({
                        where: { id: fan.id },
                        data: { timeWasterScore: Math.round(score) },
                    });
                })
            );
            summary.timeWasterScoresUpdated += chunk.length;
        }

        // --- 3. Next Best Action ---
        const allFans = await prisma.fan.findMany({
            select: {
                id: true,
                stage: true,
                intentScore: true,
                lifetimeSpend: true,
                timeWasterScore: true,
                lastPurchaseAt: true,
            },
        });

        for (let i = 0; i < allFans.length; i += CHUNK_SIZE) {
            const chunk = allFans.slice(i, i + CHUNK_SIZE);
            await Promise.all(
                chunk.map((fan) => {
                    const { action, reason } = computeNextBestAction(fan, now);
                    return prisma.fan.update({
                        where: { id: fan.id },
                        data: { nextBestAction: action, nextBestActionReason: reason },
                    });
                })
            );
            summary.nextBestActionsUpdated += chunk.length;
        }

        const durationMs = Date.now() - startTime;
        console.log(`[Cron Stage Decay] ${summary.stageChanges} stage changes, ${summary.timeWasterScoresUpdated} TW scores, ${summary.nextBestActionsUpdated} NBA updated, ${durationMs}ms`);

        return NextResponse.json({
            status: "ok",
            durationMs,
            ...summary,
        });
    } catch (err: any) {
        console.error("Cron stage-decay error:", err.message);
        return NextResponse.json(
            { error: err.message, durationMs: Date.now() - startTime },
            { status: 500 }
        );
    }
}

function computeNextBestAction(
    fan: {
        stage: string | null;
        intentScore: number | null;
        lifetimeSpend: number;
        timeWasterScore: number | null;
        lastPurchaseAt: Date | null;
    },
    now: Date
): { action: string; reason: string } {
    // High time waster score overrides everything
    if ((fan.timeWasterScore ?? 0) > 70) {
        return {
            action: "deprioritize",
            reason: `Time waster score ${fan.timeWasterScore} (>70 threshold)`,
        };
    }

    switch (fan.stage) {
        case "new":
            return {
                action: "build_rapport",
                reason: "New fan — establish connection first",
            };

        case "warming":
            if ((fan.intentScore ?? 0) > 50) {
                return {
                    action: "offer_bundle",
                    reason: `Intent score ${fan.intentScore} (>50) — ready for offer`,
                };
            }
            return {
                action: "build_rapport",
                reason: "Warming fan — continue building trust",
            };

        case "active_buyer":
            return {
                action: "upsell",
                reason: `Active buyer — lifetime spend $${fan.lifetimeSpend.toFixed(2)}`,
            };

        case "cooling_off": {
            return {
                action: "set_followup",
                reason: "Cooling off — schedule a check-in",
            };
        }

        case "at_risk":
            return {
                action: "win_back",
                reason: "At risk of churning — send win-back offer",
            };

        case "churned":
            return {
                action: "deprioritize",
                reason: "Churned fan — low ROI on outreach",
            };

        case "reactivated":
            return {
                action: "upsell",
                reason: "Reactivated — capitalize on renewed interest",
            };

        default:
            return {
                action: "build_rapport",
                reason: fan.stage ? `Unknown stage: ${fan.stage}` : "No stage set — default to rapport building",
            };
    }
}

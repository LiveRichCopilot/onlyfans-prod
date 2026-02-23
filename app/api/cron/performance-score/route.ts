import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectRobotPhrases } from "@/lib/ai-robot-detector";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/performance-score
 * Runs every 15 minutes via Vercel cron.
 *
 * Per chatter (User with CHATTER role) per creator:
 * - Count today's transactions (daily earned, PPV unlocks)
 * - Scan recent messages for robot phrases
 * - Compute score: base(50) + revenue(0-25) + creativity(0-15) + speed(0-10) - robot_penalty(0-20)
 * - Upsert ChatterPerformance record
 */
export async function GET(request: Request) {
    if (CRON_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all chatters (users assigned to creators)
        const assignments = await prisma.creatorAssignment.findMany({
            include: {
                user: true,
                creator: { select: { id: true, name: true, ofapiToken: true } },
            },
        });

        const results: any[] = [];

        for (const assignment of assignments) {
            const userId = assignment.userId;
            const creatorId = assignment.creatorId;

            try {
                // Get today's transactions for this creator
                const todayTx = await prisma.transaction.findMany({
                    where: {
                        creatorId,
                        date: { gte: today },
                    },
                });

                const dailyEarned = todayTx.reduce((sum, tx) => sum + tx.amount, 0);
                const ppvUnlocks = todayTx.filter((tx) => tx.type === "message").length;

                // For robot detection, we'd need to know which messages this chatter sent.
                // For now, we use a placeholder. In production, messages would be tagged
                // with the chatter's userId who sent them.
                // TODO: Tag outgoing messages with chatter userId for accurate attribution
                const robotResult = { robotCount: 0, creativeCount: 0, robotExamples: [], creativeExamples: [] };

                // Count conversations handled (unique fans with transactions today)
                const uniqueFans = new Set(todayTx.map((tx) => tx.fanId));

                // Compute score components
                const revenueScore = Math.min(25, dailyEarned / 20); // $500 = max 25 pts
                const creativityScore = Math.min(15, robotResult.creativeCount * 3);
                const robotPenalty = Math.min(20, robotResult.robotCount * 4);
                const speedScore = 5; // Placeholder — needs response time tracking

                const liveScore = Math.max(
                    0,
                    Math.min(100, Math.round(50 + revenueScore + creativityScore + speedScore - robotPenalty)),
                );

                // Upsert performance record
                await prisma.chatterPerformance.upsert({
                    where: {
                        userId_creatorId_date: {
                            userId,
                            creatorId,
                            date: today,
                        },
                    },
                    update: {
                        liveScore,
                        dailyEarned,
                        ppvUnlocks,
                        robotPhraseCount: robotResult.robotCount,
                        creativePhraseCount: robotResult.creativeCount,
                        conversationsHandled: uniqueFans.size,
                    },
                    create: {
                        userId,
                        creatorId,
                        date: today,
                        liveScore,
                        dailyEarned,
                        ppvUnlocks,
                        robotPhraseCount: robotResult.robotCount,
                        creativePhraseCount: robotResult.creativeCount,
                        conversationsHandled: uniqueFans.size,
                    },
                });

                results.push({
                    user: assignment.user.name,
                    creator: assignment.creator.name,
                    score: liveScore,
                    earned: dailyEarned,
                });
            } catch (e: any) {
                results.push({
                    user: assignment.user.name,
                    creator: assignment.creator.name,
                    error: e.message,
                });
            }
        }

        return NextResponse.json({ ok: true, results });
    } catch (e: any) {
        console.error("[Performance Score] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

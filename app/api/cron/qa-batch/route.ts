import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/qa-batch
 * Runs daily — auto-scores N random conversations per chatter.
 *
 * Picks random recent chats that haven't been QA'd yet,
 * calls /api/inbox/qa-score for each (internal fetch).
 */
export async function GET(request: Request) {
    if (CRON_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        // Get all active creators
        const creators = await prisma.creator.findMany({
            where: { active: true, ofapiToken: { not: null } },
        });

        // Get recently QA'd chat IDs (last 7 days) to avoid re-scoring
        const recentReviews = await prisma.chatQAReview.findMany({
            where: {
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            select: { chatId: true },
        });
        const reviewedChatIds = new Set(recentReviews.map((r) => r.chatId).filter(Boolean));

        const results: any[] = [];
        const maxPerCreator = 3; // Score 3 random conversations per creator per day

        for (const creator of creators) {
            // Get recent fans with activity (have lifecycle events)
            const recentFans = await prisma.fan.findMany({
                where: {
                    creatorId: creator.id,
                    lastMessageAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                },
                orderBy: { lastMessageAt: "desc" },
                take: 20,
            });

            // Pick random fans whose chats haven't been reviewed
            const unreviewed = recentFans.filter(
                (f) => !reviewedChatIds.has(f.ofapiFanId),
            );
            const selected = unreviewed
                .sort(() => Math.random() - 0.5)
                .slice(0, maxPerCreator);

            for (const fan of selected) {
                try {
                    // Internal API call to qa-score
                    const origin = request.headers.get("host") || "localhost:3000";
                    const protocol = origin.includes("localhost") ? "http" : "https";
                    const res = await fetch(`${protocol}://${origin}/api/inbox/qa-score`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            creatorId: creator.id,
                            chatId: fan.ofapiFanId,
                        }),
                    });
                    const data = await res.json();
                    results.push({
                        creator: creator.name,
                        fan: fan.name,
                        score: data.scores
                            ? (data.scores.controlScore + data.scores.tensionScore + data.scores.valueScore + data.scores.personalizationScore)
                            : null,
                        error: data.error || null,
                    });
                } catch (e: any) {
                    results.push({
                        creator: creator.name,
                        fan: fan.name,
                        error: e.message,
                    });
                }
            }
        }

        return NextResponse.json({ ok: true, scored: results.length, results });
    } catch (e: any) {
        console.error("[QA Batch] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

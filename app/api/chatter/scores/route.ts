import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/chatter/scores
 *
 * Returns scoreboard data for all chatters with recent scores.
 * Includes current hourly score + long-term profile.
 */
export async function GET() {
    try {
        // Get all live sessions to know who's currently on
        const liveSessions = await prisma.chatterSession.findMany({
            where: { isLive: true },
            include: { creator: { select: { id: true, name: true } } },
        });

        // Get unique chatter-creator pairs from recent scores (last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentScores = await prisma.chatterHourlyScore.findMany({
            where: { createdAt: { gte: oneDayAgo } },
            orderBy: { windowStart: "desc" },
            include: { creator: { select: { name: true } } },
        });

        // Get all profiles
        const profiles = await prisma.chatterProfile.findMany({
            include: { creator: { select: { name: true } } },
        });

        // Build scoreboard: one entry per chatter-creator pair
        const pairMap = new Map<
            string,
            {
                email: string;
                chatterName: string | null;
                creatorName: string;
                creatorId: string;
                clockIn: string | null;
                isLive: boolean;
                currentScore: (typeof recentScores)[0] | null;
                profile: (typeof profiles)[0] | null;
            }
        >();

        // Seed from profiles (long-term data)
        for (const profile of profiles) {
            const key = `${profile.chatterEmail}::${profile.creatorId}`;
            pairMap.set(key, {
                email: profile.chatterEmail,
                chatterName: profile.chatterName,
                creatorName: profile.creator.name || "Unknown",
                creatorId: profile.creatorId,
                clockIn: null,
                isLive: false,
                currentScore: null,
                profile,
            });
        }

        // Layer on recent scores (most recent per pair)
        for (const score of recentScores) {
            const key = `${score.chatterEmail}::${score.creatorId}`;
            const existing = pairMap.get(key);
            if (existing) {
                if (!existing.currentScore) {
                    existing.currentScore = score;
                }
            } else {
                pairMap.set(key, {
                    email: score.chatterEmail,
                    chatterName: null,
                    creatorName: score.creator.name || "Unknown",
                    creatorId: score.creatorId,
                    clockIn: null,
                    isLive: false,
                    currentScore: score,
                    profile: null,
                });
            }
        }

        // Layer on live sessions
        for (const session of liveSessions) {
            const key = `${session.email}::${session.creatorId}`;
            const existing = pairMap.get(key);
            if (existing) {
                existing.isLive = true;
                existing.clockIn = session.clockIn.toISOString();
            } else {
                pairMap.set(key, {
                    email: session.email,
                    chatterName: null,
                    creatorName: session.creator.name || "Unknown",
                    creatorId: session.creatorId,
                    clockIn: session.clockIn.toISOString(),
                    isLive: true,
                    currentScore: null,
                    profile: null,
                });
            }
        }

        // Convert to sorted array (live first, then by score desc)
        const scoreboard = Array.from(pairMap.values())
            .sort((a, b) => {
                // Live first
                if (a.isLive && !b.isLive) return -1;
                if (!a.isLive && b.isLive) return 1;
                // Then by most recent score
                const aScore = a.currentScore?.totalScore ?? a.profile?.avgTotalScore ?? 0;
                const bScore = b.currentScore?.totalScore ?? b.profile?.avgTotalScore ?? 0;
                return bScore - aScore;
            })
            .map((entry) => ({
                email: entry.email,
                chatterName: entry.chatterName || entry.profile?.chatterName || null,
                creatorName: entry.creatorName,
                creatorId: entry.creatorId,
                clockIn: entry.clockIn,
                isLive: entry.isLive,
                currentScore: entry.currentScore
                    ? {
                          totalScore: entry.currentScore.totalScore,
                          slaScore: entry.currentScore.slaScore,
                          followupScore: entry.currentScore.followupScore,
                          triggerScore: entry.currentScore.triggerScore,
                          qualityScore: entry.currentScore.qualityScore,
                          revenueScore: entry.currentScore.revenueScore,
                          copyPastePenalty: entry.currentScore.copyPastePenalty,
                          missedTriggerPenalty: entry.currentScore.missedTriggerPenalty,
                          spamPenalty: entry.currentScore.spamPenalty,
                          detectedArchetype: entry.currentScore.detectedArchetype,
                          windowStart: entry.currentScore.windowStart,
                          windowEnd: entry.currentScore.windowEnd,
                          messagesAnalyzed: entry.currentScore.messagesAnalyzed,
                          conversationsScanned: entry.currentScore.conversationsScanned,
                          robotPhraseCount: entry.currentScore.robotPhraseCount,
                          aiNotes: entry.currentScore.aiNotes,
                          mistakeTags: entry.currentScore.mistakeTags,
                          strengthTags: entry.currentScore.strengthTags,
                      }
                    : null,
                profile: entry.profile
                    ? {
                          avgTotalScore: entry.profile.avgTotalScore,
                          avgSlaScore: entry.profile.avgSlaScore,
                          avgFollowupScore: entry.profile.avgFollowupScore,
                          avgTriggerScore: entry.profile.avgTriggerScore,
                          avgQualityScore: entry.profile.avgQualityScore,
                          avgRevenueScore: entry.profile.avgRevenueScore,
                          dominantArchetype: entry.profile.dominantArchetype,
                          recentScores: entry.profile.recentScores,
                          improvementIndex: entry.profile.improvementIndex,
                          totalScoringSessions: entry.profile.totalScoringSessions,
                          topStrengths: entry.profile.topStrengths,
                          topWeaknesses: entry.profile.topWeaknesses,
                      }
                    : null,
            }));

        return NextResponse.json({ scoreboard });
    } catch (e: any) {
        console.error("[Scores API] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

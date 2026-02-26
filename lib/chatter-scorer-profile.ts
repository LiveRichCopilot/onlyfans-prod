/**
 * Chatter Scorer — Profile Update (EMA)
 *
 * Updates long-term chatter profile with exponential moving averages.
 */

import { prisma } from "@/lib/prisma";
import type { ScoringResult } from "./chatter-scorer-utils";

export async function updateChatterProfile(
    chatterEmail: string,
    creatorId: string,
    score: ScoringResult,
): Promise<void> {
    const alpha = 0.3; // EMA smoothing factor

    const existing = await prisma.chatterProfile.findUnique({
        where: { chatterEmail_creatorId: { chatterEmail, creatorId } },
    });

    // Compute rolling averages with EMA
    const ema = (prev: number, curr: number) => alpha * curr + (1 - alpha) * prev;

    const newAvgTotal = existing ? ema(existing.avgTotalScore, score.totalScore) : score.totalScore;
    const newAvgSla = existing ? ema(existing.avgSlaScore, score.slaScore) : score.slaScore;
    const newAvgFollowup = existing ? ema(existing.avgFollowupScore, score.followupScore) : score.followupScore;
    const newAvgTrigger = existing ? ema(existing.avgTriggerScore, score.triggerScore) : score.triggerScore;
    const newAvgQuality = existing ? ema(existing.avgQualityScore, score.qualityScore) : score.qualityScore;
    const newAvgRevenue = existing ? ema(existing.avgRevenueScore, score.revenueScore) : score.revenueScore;

    // Recent scores: keep last 10
    const recentScores: number[] = Array.isArray(existing?.recentScores)
        ? (existing.recentScores as number[])
        : [];
    recentScores.push(score.totalScore);
    if (recentScores.length > 10) recentScores.shift();

    // Improvement index: avg of recent half minus avg of older half
    let improvementIndex = 0;
    if (recentScores.length >= 4) {
        const mid = Math.floor(recentScores.length / 2);
        const olderHalf = recentScores.slice(0, mid);
        const recentHalf = recentScores.slice(mid);
        const avgOlder = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
        const avgRecent = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
        improvementIndex = Math.round((avgRecent - avgOlder) * 10) / 10;
    }

    // Archetype tracking
    const archetypeCounts: Record<string, number> = (existing?.archetypeCounts as Record<string, number>) || {};
    if (score.detectedArchetype) {
        archetypeCounts[score.detectedArchetype] = (archetypeCounts[score.detectedArchetype] || 0) + 1;
    }
    const dominantArchetype = Object.keys(archetypeCounts).length > 0
        ? Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    // Top strengths/weaknesses from recent scoring
    const topStrengths = score.strengthTags.slice(0, 5);
    const topWeaknesses = score.mistakeTags.slice(0, 5);

    const totalSessions = (existing?.totalScoringSessions || 0) + 1;

    // Get chatter name from schedule
    const schedule = await prisma.chatterSchedule.findFirst({
        where: { email: chatterEmail },
        select: { name: true },
    });

    await prisma.chatterProfile.upsert({
        where: { chatterEmail_creatorId: { chatterEmail, creatorId } },
        update: {
            avgTotalScore: Math.round(newAvgTotal * 10) / 10,
            avgSlaScore: Math.round(newAvgSla * 10) / 10,
            avgFollowupScore: Math.round(newAvgFollowup * 10) / 10,
            avgTriggerScore: Math.round(newAvgTrigger * 10) / 10,
            avgQualityScore: Math.round(newAvgQuality * 10) / 10,
            avgRevenueScore: Math.round(newAvgRevenue * 10) / 10,
            dominantArchetype,
            archetypeCounts,
            recentScores,
            improvementIndex,
            totalScoringSessions: totalSessions,
            topStrengths,
            topWeaknesses,
            chatterName: schedule?.name || existing?.chatterName,
        },
        create: {
            chatterEmail,
            creatorId,
            chatterName: schedule?.name || null,
            avgTotalScore: score.totalScore,
            avgSlaScore: score.slaScore,
            avgFollowupScore: score.followupScore,
            avgTriggerScore: score.triggerScore,
            avgQualityScore: score.qualityScore,
            avgRevenueScore: score.revenueScore,
            dominantArchetype: score.detectedArchetype,
            archetypeCounts: score.detectedArchetype ? { [score.detectedArchetype]: 1 } : {},
            recentScores: [score.totalScore],
            improvementIndex: 0,
            totalScoringSessions: 1,
            topStrengths,
            topWeaknesses,
        },
    });
}

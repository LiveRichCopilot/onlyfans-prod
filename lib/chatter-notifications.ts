/**
 * Chatter Score Notifications — Telegram
 *
 * Sends formatted score cards to creator Telegram groups/DMs.
 * Uses existing bot instance from lib/telegram.ts.
 *
 * Frequency control:
 * - First score of the shift
 * - Score < 50 (red alert)
 * - Score >= 85 (excellent)
 * - Archetype changed from profile dominant
 */

import { bot } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

type NotableQuote = {
    text: string;
    type: "great" | "good" | "bad" | "ugly";
    context: string;
};

type ScoreNotification = {
    chatterEmail: string;
    chatterName: string | null;
    creatorId: string;
    creatorName: string;
    totalScore: number;
    slaScore: number;
    followupScore: number;
    triggerScore: number;
    qualityScore: number;
    revenueScore: number;
    detectedArchetype: string | null;
    strengthTags: string[];
    mistakeTags: string[];
    aiNotes: string | null;
    notableQuotes: NotableQuote[];
    messagesAnalyzed: number;
    conversationsScanned: number;
    robotPhraseCount: number;
    creativePhraseCount: number;
};

const ARCHETYPE_LABELS: Record<string, string> = {
    yes_babe_robot: "Yes Babe Robot",
    interview_bot: "The Interview Bot",
    doormat: "The Doormat",
    commander: "The Commander",
    tease: "The Tease",
    chameleon: "The Chameleon (Gold Standard)",
};

/**
 * Determine if a score notification should be sent.
 * Returns true if we should notify.
 */
async function shouldNotify(
    chatterEmail: string,
    creatorId: string,
    totalScore: number,
    detectedArchetype: string | null,
): Promise<boolean> {
    // Always notify for extreme scores
    if (totalScore < 50) return true; // Red alert
    if (totalScore >= 85) return true; // Excellent

    // Check if this is the first score of the shift (no scores in last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentScores = await prisma.chatterHourlyScore.count({
        where: {
            chatterEmail,
            creatorId,
            createdAt: { gte: twoHoursAgo },
        },
    });

    if (recentScores <= 1) return true; // First score of shift

    // Check if archetype changed from dominant
    if (detectedArchetype) {
        const profile = await prisma.chatterProfile.findUnique({
            where: { chatterEmail_creatorId: { chatterEmail, creatorId } },
            select: { dominantArchetype: true },
        });
        if (profile?.dominantArchetype && profile.dominantArchetype !== detectedArchetype) {
            return true; // Archetype shift detected
        }
    }

    return false;
}

/**
 * Format and send a score notification to the creator's Telegram.
 */
export async function sendScoreNotification(score: ScoreNotification): Promise<boolean> {
    try {
        const shouldSend = await shouldNotify(
            score.chatterEmail,
            score.creatorId,
            score.totalScore,
            score.detectedArchetype,
        );

        if (!shouldSend) {
            console.log(`[Notify] Skipping notification for ${score.chatterEmail} (frequency control)`);
            return false;
        }

        // Find the creator's telegram destination
        const creator = await prisma.creator.findUnique({
            where: { id: score.creatorId },
            select: { telegramGroupId: true, telegramId: true },
        });

        if (!creator) return false;

        const chatId = creator.telegramGroupId || creator.telegramId;
        if (!chatId) return false;

        // Build the message
        const emoji = score.totalScore >= 85 ? "🟢" : score.totalScore >= 50 ? "🟡" : "🔴";
        const displayName = score.chatterName || score.chatterEmail.split("@")[0];

        let msg = `${emoji} CHATTER SCORE: ${displayName}\n`;
        msg += `Model: ${score.creatorName}\n`;
        msg += `Score: ${score.totalScore}/100\n\n`;

        msg += `SLA: ${score.slaScore}/25 | Follow-up: ${score.followupScore}/20\n`;
        msg += `Triggers: ${score.triggerScore}/20 | Quality: ${score.qualityScore}/20\n`;
        msg += `Revenue: ${score.revenueScore}/15\n`;

        if (score.detectedArchetype) {
            const label = ARCHETYPE_LABELS[score.detectedArchetype] || score.detectedArchetype;
            msg += `\nStyle: ${label}`;
        }

        if (score.strengthTags.length > 0) {
            msg += `\nStrengths: ${score.strengthTags.join(", ")}`;
        }

        if (score.mistakeTags.length > 0) {
            msg += `\nImprove: ${score.mistakeTags.join(", ")}`;
        }

        if (score.aiNotes) {
            msg += `\n\nNotes: ${score.aiNotes}`;
        }

        // Notable quotes
        if (score.notableQuotes?.length > 0) {
            const quoteEmoji: Record<string, string> = { great: "⭐", good: "✅", bad: "⚠️", ugly: "💀" };
            msg += `\n\nQuotes:`;
            for (const q of score.notableQuotes.slice(0, 3)) {
                msg += `\n${quoteEmoji[q.type] || "💬"} "${q.text}"`;
                if (q.context) msg += ` — ${q.context}`;
            }
        }

        msg += `\n\nMsgs: ${score.messagesAnalyzed} | Chats: ${score.conversationsScanned}`;
        msg += ` | Robot: ${score.robotPhraseCount} | Creative: ${score.creativePhraseCount}`;

        try {
            await bot.api.sendMessage(chatId, msg);
        } catch (sendErr: any) {
            const errMsg = (sendErr.message || "").toLowerCase();
            if (errMsg.includes("chat not found") || errMsg.includes("bots can't send messages to bots")) {
                console.warn(`[Notify] Telegram undeliverable (${chatId}): ${sendErr.message}`);
                return false;
            }
            throw sendErr; // Re-throw unexpected errors to outer catch
        }

        console.log(`[Notify] Sent score notification for ${displayName} to ${chatId}`);
        return true;
    } catch (e: any) {
        console.error(`[Notify] Failed to send notification:`, e.message);
        return false;
    }
}

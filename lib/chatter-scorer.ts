/**
 * Chatter Performance Scoring Engine
 *
 * Scores chatters per-hour per-creator using:
 * 1. Deterministic: SLA response times, robot phrase detection, copy/paste ratio, revenue
 * 2. AI: GPT-4o-mini for follow-up, trigger handling, quality, archetype detection
 *
 * Attribution: Messages come from creator OFAPI account. We attribute to chatters
 * using ChatterSession clock-in windows.
 */

import { prisma } from "@/lib/prisma";
import { listChats, getChatMessages } from "@/lib/ofapi";
import { detectRobotPhrases, type RobotDetectorResult } from "@/lib/ai-robot-detector";
import { stripHtml } from "@/lib/ai-classifier";
import { runAIScoring, type AIScoringResult } from "@/lib/chatter-scoring-prompt";
import { sendScoreNotification } from "@/lib/chatter-notifications";

// --- Types ---

export type ScoringWindow = {
    chatterEmail: string;
    creatorId: string;
    creatorName: string;
    ofapiCreatorId: string;
    ofapiToken: string;
    windowStart: Date; // UTC
    windowEnd: Date; // UTC
    attributionConfidence: "high" | "low";
};

type AttributedMessage = {
    text: string;
    isChatter: boolean; // true = outgoing (chatter), false = incoming (fan)
    createdAt: Date;
    chatId: string;
    fanName?: string;
};

type ScoringResult = {
    window: ScoringWindow;
    slaScore: number;
    followupScore: number;
    triggerScore: number;
    qualityScore: number;
    revenueScore: number;
    copyPastePenalty: number;
    missedTriggerPenalty: number;
    spamPenalty: number;
    totalScore: number;
    detectedArchetype: string | null;
    conversationsScanned: number;
    messagesAnalyzed: number;
    robotPhraseCount: number;
    creativePhraseCount: number;
    aiNotes: string | null;
    mistakeTags: string[];
    strengthTags: string[];
};

// --- Scoring Window Builder ---

/**
 * Build scoring windows for the last completed UK hour.
 * Returns one ScoringWindow per chatter-creator pair that was live during that hour.
 */
export async function buildScoringWindows(
    windowStart: Date,
    windowEnd: Date,
): Promise<ScoringWindow[]> {
    // Find all sessions that overlap the scoring window
    const sessions = await prisma.chatterSession.findMany({
        where: {
            OR: [
                // Session was live during the window (clocked in before window end, not clocked out before window start)
                {
                    clockIn: { lte: windowEnd },
                    OR: [{ clockOut: null }, { clockOut: { gte: windowStart } }],
                },
            ],
        },
        include: {
            creator: {
                select: {
                    id: true,
                    name: true,
                    ofapiCreatorId: true,
                    ofapiToken: true,
                },
            },
        },
    });

    // Group by chatter+creator to detect overlaps
    const pairMap = new Map<string, typeof sessions>();
    for (const session of sessions) {
        if (!session.creator.ofapiToken || !session.creator.ofapiCreatorId) continue;
        const key = `${session.email}::${session.creatorId}`;
        const existing = pairMap.get(key) || [];
        existing.push(session);
        pairMap.set(key, existing);
    }

    const windows: ScoringWindow[] = [];

    for (const [, pairSessions] of pairMap) {
        const session = pairSessions[0]; // Use first session for metadata
        const hasOverlap = pairSessions.length > 1;

        windows.push({
            chatterEmail: session.email,
            creatorId: session.creatorId,
            creatorName: session.creator.name || "Unknown",
            ofapiCreatorId: session.creator.ofapiCreatorId!,
            ofapiToken: session.creator.ofapiToken!,
            windowStart,
            windowEnd,
            attributionConfidence: hasOverlap ? "low" : "high",
        });
    }

    return windows;
}

// --- Message Fetching & Attribution ---

/**
 * Fetch recent chat messages from OFAPI and attribute them to the scoring window.
 */
export async function fetchAndAttributeMessages(
    window: ScoringWindow,
    maxChats: number = 10,
): Promise<{
    chatterMessages: string[];
    fanMessages: string[];
    allMessages: AttributedMessage[];
    responseDelays: number[];
}> {
    const chatterMessages: string[] = [];
    const fanMessages: string[] = [];
    const allMessages: AttributedMessage[] = [];
    const responseDelays: number[] = [];

    try {
        // Get recent chats
        const chatData = await listChats(window.ofapiCreatorId, window.ofapiToken, maxChats, 0);
        const chats = Array.isArray(chatData?.data) ? chatData.data : chatData?.data?.list || [];

        for (const chat of chats.slice(0, maxChats)) {
            const chatId = chat.withUser?.id || chat.id;
            const fanName = chat.withUser?.name || chat.withUser?.username || undefined;
            if (!chatId) continue;

            try {
                const msgData = await getChatMessages(
                    window.ofapiCreatorId,
                    chatId,
                    window.ofapiToken,
                    50,
                );
                const rawMsgs =
                    msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);

                // Sort chronologically
                const sorted = rawMsgs.sort(
                    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                );

                // Filter to messages within the scoring window
                const windowMsgs = sorted.filter((m: any) => {
                    const t = new Date(m.createdAt).getTime();
                    return t >= window.windowStart.getTime() && t <= window.windowEnd.getTime();
                });

                let lastFanMsgTime: number | null = null;

                for (const m of windowMsgs) {
                    const fromId = m.fromUser?.id || m.author?.id || "";
                    const isChatter = String(fromId) !== String(chatId);
                    const text = stripHtml(m.text || "").trim();
                    if (!text || text.length < 3) continue;

                    const createdAt = new Date(m.createdAt);

                    allMessages.push({
                        text,
                        isChatter,
                        createdAt,
                        chatId: String(chatId),
                        fanName,
                    });

                    if (isChatter) {
                        chatterMessages.push(text);
                        // Calculate response delay from last fan message
                        if (lastFanMsgTime) {
                            const delaySec = (createdAt.getTime() - lastFanMsgTime) / 1000;
                            if (delaySec > 0 && delaySec < 7200) {
                                // Cap at 2 hours
                                responseDelays.push(delaySec);
                            }
                        }
                        lastFanMsgTime = null;
                    } else {
                        fanMessages.push(text);
                        lastFanMsgTime = createdAt.getTime();
                    }
                }
            } catch {
                // Skip individual chat errors
            }
        }
    } catch (e: any) {
        console.error(`[Scorer] OFAPI fetch error for ${window.creatorName}:`, e.message);
    }

    return { chatterMessages, fanMessages, allMessages, responseDelays };
}

// --- Deterministic Scoring ---

/**
 * Compute SLA score from response delays (deterministic, no AI).
 */
export function computeSlaScore(responseDelays: number[]): number {
    if (responseDelays.length === 0) return 0;

    const avgDelaySec = responseDelays.reduce((a, b) => a + b, 0) / responseDelays.length;
    const avgDelayMin = avgDelaySec / 60;

    if (avgDelayMin < 2) return 25;
    if (avgDelayMin < 5) return 20;
    if (avgDelayMin < 10) return 15;
    if (avgDelayMin < 15) return 10;
    return 5;
}

/**
 * Compute revenue score from transaction totals (deterministic).
 */
export function computeRevenueScore(revenueInWindow: number): number {
    if (revenueInWindow >= 100) return 15;
    if (revenueInWindow >= 25) return 10;
    if (revenueInWindow >= 1) return 5;
    return 0;
}

/**
 * Detect copy/paste patterns in chatter messages (deterministic).
 * Returns true if >30% of messages are duplicates.
 */
export function detectCopyPaste(messages: string[]): boolean {
    if (messages.length < 5) return false;
    const normalized = messages.map((m) => m.toLowerCase().trim());
    const unique = new Set(normalized);
    const dupeRatio = 1 - unique.size / normalized.length;
    return dupeRatio > 0.3;
}

/**
 * Detect spam patterns (3+ identical messages in a row).
 */
export function detectSpam(messages: string[]): boolean {
    if (messages.length < 3) return false;
    for (let i = 0; i < messages.length - 2; i++) {
        const a = messages[i].toLowerCase().trim();
        const b = messages[i + 1].toLowerCase().trim();
        const c = messages[i + 2].toLowerCase().trim();
        if (a === b && b === c) return true;
    }
    return false;
}

// --- Revenue Lookup ---

async function getRevenueInWindow(creatorId: string, windowStart: Date, windowEnd: Date): Promise<number> {
    const txs = await prisma.transaction.aggregate({
        where: {
            creatorId,
            date: { gte: windowStart, lte: windowEnd },
        },
        _sum: { amount: true },
    });
    return txs._sum.amount || 0;
}

// --- Format Conversations for AI ---

function formatConversationsForAI(messages: AttributedMessage[]): string {
    if (messages.length === 0) return "(no messages in window)";

    // Group by chat
    const chatGroups = new Map<string, AttributedMessage[]>();
    for (const msg of messages) {
        const existing = chatGroups.get(msg.chatId) || [];
        existing.push(msg);
        chatGroups.set(msg.chatId, existing);
    }

    const parts: string[] = [];
    let chatNum = 0;

    for (const [, msgs] of chatGroups) {
        chatNum++;
        const fanName = msgs[0]?.fanName || `Fan #${chatNum}`;
        parts.push(`--- Chat with ${fanName} ---`);
        for (const m of msgs.slice(0, 30)) {
            // Limit per chat
            const role = m.isChatter ? "CHATTER" : "FAN";
            const time = m.createdAt.toISOString().slice(11, 16); // HH:MM
            parts.push(`[${time}] [${role}]: ${m.text.slice(0, 200)}`);
        }
        parts.push("");
    }

    return parts.join("\n").slice(0, 6000); // Hard cap for GPT context
}

// --- Profile Update (EMA) ---

async function updateChatterProfile(
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

// --- Main Orchestrator ---

/**
 * Score a single chatter-creator pair for a given time window.
 * Phase 4A: deterministic scoring (SLA, robot, copypaste, revenue)
 * Phase 4B: AI scoring (followup, trigger, quality, archetype)
 */
export async function scoreChatter(
    window: ScoringWindow,
    useAI: boolean = true,
): Promise<ScoringResult | null> {
    try {
        // Check for existing score (idempotency via unique constraint)
        const existing = await prisma.chatterHourlyScore.findUnique({
            where: {
                chatterEmail_creatorId_windowStart: {
                    chatterEmail: window.chatterEmail,
                    creatorId: window.creatorId,
                    windowStart: window.windowStart,
                },
            },
        });
        if (existing) {
            console.log(`[Scorer] Score already exists for ${window.chatterEmail} @ ${window.creatorName}`);
            return null;
        }

        // Fetch and attribute messages
        const { chatterMessages, fanMessages, allMessages, responseDelays } =
            await fetchAndAttributeMessages(window);

        if (allMessages.length === 0) {
            console.log(`[Scorer] No messages for ${window.chatterEmail} @ ${window.creatorName}`);
            return null;
        }

        // Deterministic scores
        const slaScoreDet = computeSlaScore(responseDelays);
        const robotResult: RobotDetectorResult = detectRobotPhrases(chatterMessages);
        const copyPasteDetected = detectCopyPaste(chatterMessages);
        const spamDetected = detectSpam(chatterMessages);
        const revenue = await getRevenueInWindow(window.creatorId, window.windowStart, window.windowEnd);
        const revenueScore = computeRevenueScore(revenue);

        // AI scoring (Phase 4B)
        let aiResult: AIScoringResult | null = null;
        if (useAI && allMessages.length >= 3) {
            const formatted = formatConversationsForAI(allMessages);
            const avgResponseTimeSec =
                responseDelays.length > 0
                    ? responseDelays.reduce((a, b) => a + b, 0) / responseDelays.length
                    : null;

            aiResult = await runAIScoring(formatted, {
                chatterEmail: window.chatterEmail,
                creatorName: window.creatorName,
                avgResponseTimeSec,
                robotPhraseCount: robotResult.robotCount,
                creativePhraseCount: robotResult.creativeCount,
                totalMessages: allMessages.length,
            });
        }

        // Merge deterministic + AI scores
        const slaScore = aiResult ? aiResult.slaScore : slaScoreDet;
        const followupScore = aiResult?.followupScore || 0;
        const triggerScore = aiResult?.triggerScore || 0;
        const qualityScore = aiResult?.qualityScore || 0;

        // Penalties
        const copyPastePenalty = copyPasteDetected || aiResult?.copyPasteDetected ? -10 : 0;
        const missedTriggerPenalty = aiResult?.missedHighIntent ? -10 : 0;
        const spamPenalty = spamDetected || aiResult?.spamDetected ? -10 : 0;

        // Total clamped to 0-100
        const rawTotal =
            slaScore + followupScore + triggerScore + qualityScore + revenueScore +
            copyPastePenalty + missedTriggerPenalty + spamPenalty;
        const totalScore = Math.max(0, Math.min(100, rawTotal));

        const chatIds = new Set(allMessages.map((m) => m.chatId));

        const result: ScoringResult = {
            window,
            slaScore,
            followupScore,
            triggerScore,
            qualityScore,
            revenueScore,
            copyPastePenalty,
            missedTriggerPenalty,
            spamPenalty,
            totalScore,
            detectedArchetype: aiResult?.detectedArchetype || null,
            conversationsScanned: chatIds.size,
            messagesAnalyzed: allMessages.length,
            robotPhraseCount: robotResult.robotCount,
            creativePhraseCount: robotResult.creativeCount,
            aiNotes: aiResult?.notes || null,
            mistakeTags: aiResult?.mistakeTags || [],
            strengthTags: aiResult?.strengthTags || [],
        };

        // Save to DB
        await prisma.chatterHourlyScore.create({
            data: {
                chatterEmail: window.chatterEmail,
                creatorId: window.creatorId,
                windowStart: window.windowStart,
                windowEnd: window.windowEnd,
                slaScore: result.slaScore,
                followupScore: result.followupScore,
                triggerScore: result.triggerScore,
                qualityScore: result.qualityScore,
                revenueScore: result.revenueScore,
                copyPastePenalty: result.copyPastePenalty,
                missedTriggerPenalty: result.missedTriggerPenalty,
                spamPenalty: result.spamPenalty,
                totalScore: result.totalScore,
                attributionConfidence: window.attributionConfidence,
                detectedArchetype: result.detectedArchetype,
                conversationsScanned: result.conversationsScanned,
                messagesAnalyzed: result.messagesAnalyzed,
                robotPhraseCount: result.robotPhraseCount,
                creativePhraseCount: result.creativePhraseCount,
                aiNotes: result.aiNotes,
                mistakeTags: result.mistakeTags,
                strengthTags: result.strengthTags,
            },
        });

        // Update long-term profile
        await updateChatterProfile(window.chatterEmail, window.creatorId, result);

        // Send Telegram notification (frequency-controlled)
        const schedule = await prisma.chatterSchedule.findFirst({
            where: { email: window.chatterEmail },
            select: { name: true },
        });

        await sendScoreNotification({
            chatterEmail: window.chatterEmail,
            chatterName: schedule?.name || null,
            creatorId: window.creatorId,
            creatorName: window.creatorName,
            totalScore: result.totalScore,
            slaScore: result.slaScore,
            followupScore: result.followupScore,
            triggerScore: result.triggerScore,
            qualityScore: result.qualityScore,
            revenueScore: result.revenueScore,
            detectedArchetype: result.detectedArchetype,
            strengthTags: result.strengthTags,
            mistakeTags: result.mistakeTags,
            aiNotes: result.aiNotes,
            messagesAnalyzed: result.messagesAnalyzed,
            conversationsScanned: result.conversationsScanned,
            robotPhraseCount: result.robotPhraseCount,
            creativePhraseCount: result.creativePhraseCount,
        }).catch((e) => console.error("[Scorer] Notification failed:", e.message));

        console.log(
            `[Scorer] ${window.chatterEmail} @ ${window.creatorName}: ${result.totalScore}/100 (${result.detectedArchetype || "no archetype"})`,
        );

        return result;
    } catch (e: any) {
        console.error(`[Scorer] Error scoring ${window.chatterEmail}:`, e.message);
        return null;
    }
}

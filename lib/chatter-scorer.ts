/**
 * Chatter Performance Scoring Engine — Main Orchestrator
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
import {
    type ScoringWindow,
    type AttributedMessage,
    type ScoringResult,
    computeSlaScore,
    computeRevenueScore,
    detectCopyPaste,
    detectSpam,
    getRevenueInWindow,
    formatConversationsForAI,
} from "./chatter-scorer-utils";
import { updateChatterProfile } from "./chatter-scorer-profile";
import { runStoryAnalysis } from "./chatter-story-analyzer";

// Re-export types for consumers
export type { ScoringWindow, ScoringResult } from "./chatter-scorer-utils";

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
        const session = pairSessions[0];
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
    maxChats: number = 5,
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
        const chatData = await listChats(window.ofapiCreatorId, window.ofapiToken, maxChats, 0);
        const chats = Array.isArray(chatData?.data) ? chatData.data : chatData?.data?.list || [];

        for (const chat of chats.slice(0, maxChats)) {
            const chatId = chat.withUser?.id || chat.fan?.id || chat.id;
            const fanName = chat.withUser?.name || chat.withUser?.username || chat.fan?.name || chat.fan?.username || undefined;
            if (!chatId) continue;

            try {
                const msgData = await getChatMessages(window.ofapiCreatorId, chatId, window.ofapiToken, 50);
                const rawMsgs = msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);

                const sorted = rawMsgs.sort(
                    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                );

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

                    allMessages.push({ text, isChatter, createdAt, chatId: String(chatId), fanName });

                    if (isChatter) {
                        chatterMessages.push(text);
                        if (lastFanMsgTime) {
                            const delaySec = (createdAt.getTime() - lastFanMsgTime) / 1000;
                            if (delaySec > 0 && delaySec < 7200) {
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

// --- Main Orchestrator ---

/**
 * Score a single chatter-creator pair for a given time window.
 */
export async function scoreChatter(
    window: ScoringWindow,
    useAI: boolean = true,
): Promise<ScoringResult | null> {
    try {
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

        const { chatterMessages, allMessages, responseDelays } =
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

        // AI scoring
        const formatted = formatConversationsForAI(allMessages);
        let aiResult: AIScoringResult | null = null;
        if (useAI && allMessages.length >= 3) {
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

        const copyPastePenalty = copyPasteDetected || aiResult?.copyPasteDetected ? -10 : 0;
        const missedTriggerPenalty = aiResult?.missedHighIntent ? -10 : 0;
        const spamPenalty = spamDetected || aiResult?.spamDetected ? -10 : 0;

        const rawTotal = slaScore + followupScore + triggerScore + qualityScore + revenueScore +
            copyPastePenalty + missedTriggerPenalty + spamPenalty;
        const totalScore = Math.max(0, Math.min(100, rawTotal));

        const chatIds = new Set(allMessages.map((m) => m.chatId));

        const result: ScoringResult = {
            window, slaScore, followupScore, triggerScore, qualityScore, revenueScore,
            copyPastePenalty, missedTriggerPenalty, spamPenalty, totalScore,
            detectedArchetype: aiResult?.detectedArchetype || null,
            conversationsScanned: chatIds.size,
            messagesAnalyzed: allMessages.length,
            robotPhraseCount: robotResult.robotCount,
            creativePhraseCount: robotResult.creativeCount,
            aiNotes: aiResult?.notes || null,
            mistakeTags: aiResult?.mistakeTags || [],
            strengthTags: aiResult?.strengthTags || [],
        };

        // Build conversation snippets grouped by chat (limit to 10 chats, 20 msgs each)
        const chatGroups = new Map<string, typeof allMessages>();
        for (const m of allMessages) {
            const group = chatGroups.get(m.chatId) || [];
            if (group.length < 20) group.push(m);
            chatGroups.set(m.chatId, group);
        }
        const conversationData = [...chatGroups.entries()].slice(0, 10).map(([chatId, msgs]) => ({
            chatId,
            fanName: msgs.find(m => !m.isChatter)?.fanName || `Fan ${chatId.slice(-4)}`,
            messages: msgs.map(m => ({
                text: m.text.slice(0, 500),
                isChatter: m.isChatter,
                time: m.createdAt.toISOString(),
            })),
        }));

        // Run story analysis on conversations with enough messages (best-effort, non-blocking)
        let storyAnalysis = null;
        if (useAI && allMessages.length >= 8) {
            try {
                storyAnalysis = await runStoryAnalysis(formatted, allMessages.length);
            } catch (e: any) {
                console.error("[Scorer] Story analysis failed:", e.message);
            }
        }

        // Enrich conversationData with story analysis if available
        const enrichedConversationData = storyAnalysis
            ? { conversations: conversationData, storyAnalysis }
            : conversationData;

        // Detect copy-paste blasting (same message sent to 2+ fans)
        const blastMap = new Map<string, Set<string>>();
        for (const m of allMessages) {
            if (!m.isChatter || m.text.length < 20) continue;
            const key = m.text.toLowerCase().trim();
            const fans = blastMap.get(key) || new Set();
            fans.add(m.chatId);
            blastMap.set(key, fans);
        }
        const copyPasteBlasts = [...blastMap.entries()]
            .filter(([, fans]) => fans.size >= 2)
            .sort((a, b) => b[1].size - a[1].size)
            .slice(0, 10)
            .map(([message, fans]) => ({ message: message.slice(0, 300), fanCount: fans.size }));

        // Save to DB
        await prisma.chatterHourlyScore.create({
            data: {
                chatterEmail: window.chatterEmail, creatorId: window.creatorId,
                windowStart: window.windowStart, windowEnd: window.windowEnd,
                slaScore: result.slaScore, followupScore: result.followupScore,
                triggerScore: result.triggerScore, qualityScore: result.qualityScore,
                revenueScore: result.revenueScore, copyPastePenalty: result.copyPastePenalty,
                missedTriggerPenalty: result.missedTriggerPenalty, spamPenalty: result.spamPenalty,
                totalScore: result.totalScore, attributionConfidence: window.attributionConfidence,
                detectedArchetype: result.detectedArchetype,
                conversationsScanned: result.conversationsScanned,
                messagesAnalyzed: result.messagesAnalyzed,
                robotPhraseCount: result.robotPhraseCount,
                creativePhraseCount: result.creativePhraseCount,
                aiNotes: result.aiNotes,
                notableQuotes: aiResult?.notableQuotes || [],
                conversationData: conversationData.length > 0 ? enrichedConversationData : undefined,
                copyPasteBlasts: copyPasteBlasts.length > 0 ? copyPasteBlasts : undefined,
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
            notableQuotes: aiResult?.notableQuotes || [],
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

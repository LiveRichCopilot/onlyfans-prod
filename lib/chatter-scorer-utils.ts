/**
 * Chatter Scorer — Types & Deterministic Scoring
 *
 * Types, SLA scoring, copy/paste detection, spam detection,
 * revenue lookup, and conversation formatting for AI.
 */

import { prisma } from "@/lib/prisma";

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

export type AttributedMessage = {
    text: string;
    isChatter: boolean; // true = outgoing (chatter), false = incoming (fan)
    createdAt: Date;
    chatId: string;
    fanName?: string;
};

export type ScoringResult = {
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

export async function getRevenueInWindow(creatorId: string, windowStart: Date, windowEnd: Date): Promise<number> {
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

export function formatConversationsForAI(messages: AttributedMessage[]): string {
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

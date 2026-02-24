/**
 * AI Context Bundle Builder
 *
 * Builds a compact, ranked context bundle for AI hint generation.
 * Instead of dumping "last 20 messages," this:
 *
 * 1. Loads top facts (ranked by recency + confidence + relevance)
 * 2. Loads temporal anchors (promises, sick pet, payday, etc. from last 7d)
 * 3. Loads objection history (last 3 objections + what worked)
 * 4. Loads purchase summary (aggregates + last 5 purchase contexts)
 * 5. Loads recent chat (last 40-60 messages OR last 24h, whichever is smaller)
 * 6. Retrieves relevant historical snippets via keyword search
 *
 * Returns a compressed context string within a token budget.
 */

import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { stripHtml } from "@/lib/ai-classifier";

// Token budget: ~2000 tokens for context, ~500 for instructions = ~2500 total
const MAX_CONTEXT_CHARS = 6000; // ~1500 tokens at 4 chars/token

export type ContextBundle = {
    recentMessages: string[];        // Fan messages from recent chat
    topFacts: { key: string; value: string; age: string }[];
    temporalAnchors: { key: string; value: string; daysAgo: number }[];
    objectionHistory: string[];
    purchaseSummary: string;
    purchaseContexts: { when: string; amount: number; context: string }[];
    retrievedSnippets: string[];     // Keyword-matched historical snippets
    missingContext: string[];        // What we couldn't find
    contextQuality: "rich" | "partial" | "minimal";  // How much data we have
    lastFanMessageTs: number | null; // Actual timestamp of most recent fan message from OFAPI (ms)
};

// Keywords to search for in message history (needle-in-haystack retrieval)
const RETRIEVAL_KEYWORDS: Record<string, string[]> = {
    family: ["wife", "husband", "girlfriend", "boyfriend", "daughter", "son", "kids", "baby", "mom", "dad", "brother", "sister", "family"],
    work: ["work", "job", "boss", "office", "shift", "salary", "payday", "fired", "promoted", "retire"],
    pets: ["dog", "cat", "puppy", "kitten", "pet", "vet", "sick", "died"],
    preferences: ["love", "favorite", "hate", "prefer", "always", "never", "starbucks", "coffee", "beer", "wine"],
    location: ["live in", "from", "moved to", "city", "state", "country", "timezone"],
    emotional: ["stressed", "lonely", "sad", "happy", "excited", "depressed", "anxious", "birthday", "anniversary"],
};

/**
 * Build a compact context bundle for AI hint generation.
 */
export async function buildContextBundle(params: {
    creatorId: string;
    chatId: string;
    fanOfapiId: string;
    accountName: string;
    apiKey: string;
}): Promise<ContextBundle> {
    const { creatorId, chatId, fanOfapiId, accountName, apiKey } = params;
    const missingContext: string[] = [];

    // 1. Load fan with facts + preferences from DB
    const fan = await prisma.fan.findFirst({
        where: { ofapiFanId: fanOfapiId, creatorId },
        include: {
            preferences: { orderBy: { weight: "desc" }, take: 20 },
            facts: { orderBy: { lastConfirmedAt: "desc" }, take: 25 },
            lifecycleEvents: {
                where: {
                    createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            },
        },
    });

    // 2. Top Facts — ranked by recency + confidence, filtered for freshness
    const now = Date.now();
    const topFacts = (fan?.facts || [])
        .filter((f) => {
            // Skip facts older than 90 days with low confidence
            const ageMs = now - (f.lastConfirmedAt?.getTime() || f.createdAt.getTime());
            const ageDays = ageMs / 86400000;
            if (ageDays > 90 && f.confidence < 0.7) return false;
            return true;
        })
        .slice(0, 15)
        .map((f) => {
            const ageMs = now - (f.lastConfirmedAt?.getTime() || f.createdAt.getTime());
            const ageDays = Math.floor(ageMs / 86400000);
            return {
                key: f.key,
                value: f.value,
                age: ageDays === 0 ? "today" : ageDays === 1 ? "yesterday" : `${ageDays}d ago`,
            };
        });

    if (topFacts.length === 0) missingContext.push("no_personal_facts");

    // 3. Temporal Anchors — actionable facts from last 7 days
    const TEMPORAL_KEYS = new Set([
        "pet_sick", "promise_made", "birthday", "avoid_topic", "trigger_topic",
        "vacation", "payday", "breakup", "promotion", "loss",
    ]);
    const temporalAnchors = (fan?.facts || [])
        .filter((f) => {
            if (!TEMPORAL_KEYS.has(f.key)) return false;
            const ageMs = now - (f.lastConfirmedAt?.getTime() || f.createdAt.getTime());
            return ageMs < 7 * 24 * 60 * 60 * 1000; // Last 7 days only
        })
        .map((f) => ({
            key: f.key,
            value: f.value,
            daysAgo: Math.floor((now - (f.lastConfirmedAt?.getTime() || f.createdAt.getTime())) / 86400000),
        }));

    // 4. Objection History — from lifecycle events + fan fields
    const objectionHistory: string[] = [];
    if (fan?.lastObjection) objectionHistory.push(`Last objection: ${fan.lastObjection}`);
    if (fan?.topObjection && fan.topObjection !== fan.lastObjection) {
        objectionHistory.push(`Most common objection: ${fan.topObjection}`);
    }
    // Check lifecycle events for objection-related notes
    const objectionEvents = (fan?.lifecycleEvents || [])
        .filter((e) => e.type === "purchase" && e.metadata && (e.metadata as any).purchaseType)
        .slice(0, 3);
    if (objectionEvents.length > 0) {
        objectionHistory.push(`Last ${objectionEvents.length} purchases were: ${objectionEvents.map((e) => `$${(e.metadata as any).amount} (${(e.metadata as any).purchaseType})`).join(", ")}`);
    }

    // 5. Purchase Summary — aggregates + last 5 purchase contexts
    const transactions = fan
        ? await prisma.transaction.findMany({
              where: { fanId: fan.id },
              orderBy: { date: "desc" },
              take: 10,
          })
        : [];

    const totalSpend = fan?.lifetimeSpend || 0;
    const last30dSpend = transactions
        .filter((t) => t.date.getTime() > now - 30 * 86400000)
        .reduce((sum, t) => sum + t.amount, 0);

    const purchaseSummary = fan
        ? `Lifetime: $${totalSpend.toFixed(0)} | Last 30d: $${last30dSpend.toFixed(0)} | Avg order: $${(fan.avgOrderValue || 0).toFixed(0)} | Type: ${fan.buyerType || "unknown"} | Last purchase: ${fan.lastPurchaseAt ? Math.floor((now - fan.lastPurchaseAt.getTime()) / 86400000) + "d ago" : "never"}`
        : "No purchase data";

    if (totalSpend === 0) missingContext.push("no_purchase_history");

    // Purchase contexts — messages around purchases (precomputed from lifecycle events)
    const purchaseContexts = transactions.slice(0, 5).map((t) => ({
        when: `${Math.floor((now - t.date.getTime()) / 86400000)}d ago`,
        amount: t.amount,
        context: `$${t.amount} ${t.type || "purchase"}`,
    }));

    // 6. Fetch recent messages from OFAPI
    let recentFanMessages: string[] = [];
    let allRecentMessages: { text: string; fromFan: boolean; ts: number }[] = [];

    try {
        const msgData = await getChatMessages(accountName, chatId, apiKey, 60);
        const rawMsgs = msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);

        // Sort chronologically (ascending)
        const sorted = [...rawMsgs].sort(
            (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        allRecentMessages = sorted.map((m: any) => {
            const fromId = m.fromUser?.id || m.author?.id || "";
            const isFan = String(fromId) === String(fanOfapiId);
            return {
                text: stripHtml(m.text || ""),
                fromFan: isFan,
                ts: new Date(m.createdAt).getTime(),
            };
        }).filter((m) => m.text.length > 0);

        // Fan messages only (for analysis)
        recentFanMessages = allRecentMessages
            .filter((m) => m.fromFan)
            .slice(-30)  // Last 30 fan messages
            .map((m) => m.text);

        // Include timestamps so model can reason about recency
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        const recentWindow = allRecentMessages.filter((m) => m.ts > twentyFourHoursAgo);

        // If we have messages in last 24h, use those. Otherwise use last 40.
        if (recentWindow.length >= 5) {
            recentFanMessages = recentWindow
                .filter((m) => m.fromFan)
                .map((m) => {
                    const hoursAgo = Math.round((now - m.ts) / 3600000);
                    return `[${hoursAgo}h ago] ${m.text}`;
                });
        } else {
            recentFanMessages = allRecentMessages
                .filter((m) => m.fromFan)
                .slice(-20)
                .map((m) => {
                    const daysAgo = Math.round((now - m.ts) / 86400000);
                    return `[${daysAgo}d ago] ${m.text}`;
                });
        }
    } catch (e) {
        missingContext.push("could_not_fetch_messages");
    }

    if (recentFanMessages.length < 3) missingContext.push("very_few_messages");

    // Compute actual last fan message timestamp from OFAPI data (not stale DB)
    const fanOnlyMessages = allRecentMessages.filter(m => m.fromFan);
    const lastFanMessageTs = fanOnlyMessages.length > 0
        ? Math.max(...fanOnlyMessages.map(m => m.ts))
        : null;

    // 7. Keyword retrieval — search recent messages for family/work/pet mentions
    const retrievedSnippets: string[] = [];
    for (const [category, keywords] of Object.entries(RETRIEVAL_KEYWORDS)) {
        for (const msg of allRecentMessages) {
            if (!msg.fromFan) continue;
            const lower = msg.text.toLowerCase();
            const match = keywords.some((kw) => lower.includes(kw));
            if (match && !retrievedSnippets.includes(msg.text)) {
                const daysAgo = Math.round((now - msg.ts) / 86400000);
                retrievedSnippets.push(`[${category}, ${daysAgo}d ago] ${msg.text.slice(0, 150)}`);
                if (retrievedSnippets.length >= 10) break;
            }
        }
        if (retrievedSnippets.length >= 10) break;
    }

    // 8. Determine context quality
    let contextQuality: "rich" | "partial" | "minimal" = "minimal";
    if (topFacts.length >= 5 && recentFanMessages.length >= 10 && totalSpend > 0) {
        contextQuality = "rich";
    } else if (topFacts.length >= 2 || recentFanMessages.length >= 5) {
        contextQuality = "partial";
    }

    return {
        recentMessages: recentFanMessages,
        topFacts,
        temporalAnchors,
        objectionHistory,
        purchaseSummary,
        purchaseContexts,
        retrievedSnippets,
        missingContext,
        contextQuality,
        lastFanMessageTs,
    };
}

/**
 * Compress context bundle into a string within token budget.
 */
export function compressBundle(bundle: ContextBundle): string {
    const parts: string[] = [];
    let charCount = 0;

    const addIfBudget = (label: string, content: string) => {
        if (charCount + content.length > MAX_CONTEXT_CHARS) return false;
        parts.push(`## ${label}\n${content}`);
        charCount += label.length + content.length + 5;
        return true;
    };

    // Priority 1: Temporal anchors (most actionable)
    if (bundle.temporalAnchors.length > 0) {
        addIfBudget("Temporal Anchors (ACT ON THESE FIRST)",
            bundle.temporalAnchors.map((a) => `- ${a.key}: "${a.value}" (${a.daysAgo}d ago)`).join("\n"));
    }

    // Priority 2: Purchase summary (essential for pricing/intent)
    addIfBudget("Purchase Profile", bundle.purchaseSummary);

    // Priority 3: Top facts (personal connection)
    if (bundle.topFacts.length > 0) {
        addIfBudget("Personal Facts",
            bundle.topFacts.slice(0, 10).map((f) => `- ${f.key}: "${f.value}" (${f.age})`).join("\n"));
    }

    // Priority 4: Objection history
    if (bundle.objectionHistory.length > 0) {
        addIfBudget("Objection History", bundle.objectionHistory.join("\n"));
    }

    // Priority 5: Retrieved snippets (long-term memory hits)
    if (bundle.retrievedSnippets.length > 0) {
        addIfBudget("Relevant Historical Messages",
            bundle.retrievedSnippets.slice(0, 5).join("\n"));
    }

    // Priority 6: Recent fan messages (use remaining budget)
    const remainingBudget = MAX_CONTEXT_CHARS - charCount;
    const msgBudget = Math.max(500, remainingBudget);
    let msgContent = "";
    for (const msg of bundle.recentMessages) {
        if (msgContent.length + msg.length > msgBudget) break;
        msgContent += msg + "\n";
    }
    if (msgContent) {
        parts.push(`## Recent Fan Messages\n${msgContent.trim()}`);
    }

    // Priority 7: Missing context warning
    if (bundle.missingContext.length > 0) {
        parts.push(`## Missing Context: ${bundle.missingContext.join(", ")}`);
    }

    return parts.join("\n\n");
}

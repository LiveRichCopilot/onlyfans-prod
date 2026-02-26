/**
 * AI Closing Hints — "Digital Wingwoman" (v2)
 *
 * Production-ready with:
 * - Cache keyed by creatorId:chatId:lastMessageTs (not just fanId)
 * - Confidence + missingContext fields
 * - Token-budgeted context (uses ai-context-bundle)
 * - Strict output shape (all sections always present)
 * - Rate limiting metadata
 *
 * Uses GPT-4o-mini (~$0.0005 per call with compressed context).
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

// --- Result Schema (v1 — stable, all sections always present) ---

export type ClosingHintsResult = {
    version: "v1";
    strikeZone: "green" | "yellow" | "red";
    strikeZoneReason: string;
    buyCue: {
        detected: boolean;
        quote: string;
        meaning: string;
    };
    personalBridge: {
        detected: boolean;
        fact: string;
        value: string;
        suggestion: string;
    };
    objectionSniper: {
        detected: boolean;
        objection: string;
        rebuttals: string[];
    };
    draftMessage: string;
    confidence: number;             // 0-1 overall
    contextQuality: "rich" | "partial" | "minimal";
    missingContext: string[];        // What data was unavailable
    isLowConfidence: boolean;        // UI should show "suggestion" not "instruction"
    tokenUsage?: {
        prompt: number;
        completion: number;
        total: number;
    };
};

// --- Cache (best-effort, serverless-aware) ---
// Key: `${creatorId}:${chatId}:${lastMsgTs}` — invalidates when new message arrives
// TTL: 30s (short because serverless instances are ephemeral anyway)

type CacheEntry = { result: ClosingHintsResult; ts: number };
const hintCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds (serverless = ephemeral, keep short)
const MAX_CACHE_SIZE = 200;

export function buildCacheKey(creatorId: string, chatId: string, lastMessageTs?: string): string {
    // Include lastMessageTs so a new inbound message invalidates the cache
    return `${creatorId}:${chatId}:${lastMessageTs || "none"}`;
}

export function getCachedHints(key: string): ClosingHintsResult | null {
    const entry = hintCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        hintCache.delete(key);
        return null;
    }
    return entry.result;
}

export function setCachedHints(key: string, result: ClosingHintsResult): void {
    hintCache.set(key, { result, ts: Date.now() });
    if (hintCache.size > MAX_CACHE_SIZE) {
        // Evict oldest 50
        const entries = [...hintCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
        for (let i = 0; i < 50; i++) hintCache.delete(entries[i][0]);
    }
}

// --- Rate Limiter (per-user per-chat, best-effort in serverless) ---
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000; // 1 request per 10 seconds per chat

export function checkRateLimit(key: string): boolean {
    const last = rateLimitMap.get(key);
    if (last && Date.now() - last < RATE_LIMIT_MS) return false;
    rateLimitMap.set(key, Date.now());
    // Evict old entries
    if (rateLimitMap.size > 500) {
        const now = Date.now();
        for (const [k, ts] of rateLimitMap) {
            if (now - ts > 60000) rateLimitMap.delete(k);
        }
    }
    return true;
}

// --- Strike Zone (deterministic, no AI) ---

export function computeStrikeZone(intel: {
    intentScore: number | null;
    stage: string | null;
    lastMessageAt: string | null;
}): { zone: "green" | "yellow" | "red"; reason: string } {
    const score = intel.intentScore ?? 0;
    const stage = intel.stage || "new";
    const lastMsg = intel.lastMessageAt ? new Date(intel.lastMessageAt) : null;
    const hoursSinceMsg = lastMsg ? (Date.now() - lastMsg.getTime()) / 3600000 : 999;

    if (score > 60 && ["warming", "active_buyer", "reactivated"].includes(stage)) {
        return { zone: "green", reason: "High intent + active buyer — pitch now" };
    }
    if (score > 80) {
        return { zone: "green", reason: `Intent score ${score} — strong buying signals` };
    }
    if (score < 30 && ["at_risk", "churned"].includes(stage)) {
        return { zone: "red", reason: "Low intent + at risk — rebuild rapport first" };
    }
    if (hoursSinceMsg > 72) {
        return { zone: "red", reason: "No messages in 3+ days — re-engage before pitching" };
    }
    if (score < 20) {
        return { zone: "red", reason: "Very low intent — focus on connection, not selling" };
    }
    if (stage === "cooling_off" && hoursSinceMsg < 24) {
        return { zone: "yellow", reason: "Cooling off but recently active — tread carefully" };
    }
    return { zone: "yellow", reason: `Moderate intent (${score}) — warm up before pitching` };
}

// --- AI Prompt (uses compressed context from bundle) ---

const HINTS_SYSTEM_PROMPT = `You are a closing coach for an OnlyFans chatter. You analyze a fan's context bundle and give real-time selling advice.

The context bundle includes timestamped data — use recency to judge relevance.
If data is missing or sparse, lower your confidence and say so.

Return a JSON object with ALL of these fields (even if empty):

{
  "buyCue": {
    "detected": true/false,
    "quote": "exact phrase from messages or empty string",
    "meaning": "what this means for selling"
  },
  "personalBridge": {
    "detected": true/false,
    "fact": "which fact key",
    "value": "the fact value",
    "suggestion": "how to bridge to content"
  },
  "objectionSniper": {
    "detected": true/false,
    "objection": "price|trust|value|timing|none",
    "rebuttals": ["witty rebuttal 1", "witty rebuttal 2"]
  },
  "draftMessage": "suggested next message (under 40 words)",
  "confidence": 0.0-1.0
}

Rules:
- ALL sections must be present. Use detected=false when nothing found.
- Match the fan's tone preference and emotional needs
- If Strike Zone is green: soft sell in draft
- If yellow: rapport building in draft
- If red: pure connection, no selling in draft
- Keep draftMessage natural, flirty, under 40 words
- Be honest about confidence — low data = low confidence`;

/**
 * Get AI-powered closing hints using a compressed context bundle.
 */
export async function getClosingHints(params: {
    fanName?: string;
    intelligence: {
        stage: string | null;
        fanType: string | null;
        tonePreference: string | null;
        priceRange: string | null;
        intentScore: number | null;
        emotionalDrivers: string | null;
        emotionalNeeds: string | null;
        nextBestAction: string | null;
        nextBestActionReason: string | null;
        lastMessageAt: string | null;
        buyerType: string | null;
        lastObjection?: string | null;
        topObjection?: string | null;
        formatPreference: string | null;
    } | null;
    compressedContext: string;         // Pre-compressed from ai-context-bundle
    contextQuality: "rich" | "partial" | "minimal";
    missingContext: string[];
}): Promise<ClosingHintsResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("[AI Hints] OPENAI_API_KEY not set");
        return null;
    }

    const intel = params.intelligence;
    const strikeZone = computeStrikeZone({
        intentScore: intel?.intentScore ?? null,
        stage: intel?.stage ?? null,
        lastMessageAt: intel?.lastMessageAt ?? null,
    });

    // Intelligence summary (compact)
    const intelLine = intel
        ? `Stage=${intel.stage||"?"} Type=${intel.fanType||"?"} Tone=${intel.tonePreference||"?"} Price=${intel.priceRange||"?"} Intent=${intel.intentScore??0}/100 Buyer=${intel.buyerType||"?"} Emotion=${intel.emotionalDrivers||"?"} Format=${intel.formatPreference||"?"}`
        : "No intelligence data (new fan)";

    const userPrompt = `Fan: ${params.fanName || "Anonymous"}
Strike Zone: ${strikeZone.zone.toUpperCase()} — ${strikeZone.reason}
Context Quality: ${params.contextQuality}

${intelLine}

${params.compressedContext}`;

    try {
        const response = await fetch(OPENAI_BASE, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-5-mini",
                messages: [
                    { role: "system", content: HINTS_SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.4,
                max_tokens: 500,   // Hard cap
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[AI Hints] OpenAI error:", response.status, errText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const parsed = JSON.parse(content);
        const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

        // Adjust confidence based on context quality
        let adjustedConfidence = rawConfidence;
        if (params.contextQuality === "minimal") adjustedConfidence = Math.min(adjustedConfidence, 0.3);
        else if (params.contextQuality === "partial") adjustedConfidence = Math.min(adjustedConfidence, 0.6);

        const tokenUsage = data.usage
            ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens, total: data.usage.total_tokens }
            : undefined;

        return {
            version: "v1",
            strikeZone: strikeZone.zone,
            strikeZoneReason: strikeZone.reason,
            buyCue: {
                detected: parsed.buyCue?.detected === true,
                quote: parsed.buyCue?.quote || "",
                meaning: parsed.buyCue?.meaning || "No buying signal detected",
            },
            personalBridge: {
                detected: parsed.personalBridge?.detected === true,
                fact: parsed.personalBridge?.fact || "",
                value: parsed.personalBridge?.value || "",
                suggestion: parsed.personalBridge?.suggestion || "",
            },
            objectionSniper: {
                detected: parsed.objectionSniper?.detected === true && parsed.objectionSniper?.objection !== "none",
                objection: parsed.objectionSniper?.objection || "none",
                rebuttals: Array.isArray(parsed.objectionSniper?.rebuttals)
                    ? parsed.objectionSniper.rebuttals.slice(0, 2)
                    : [],
            },
            draftMessage: parsed.draftMessage || "",
            confidence: adjustedConfidence,
            contextQuality: params.contextQuality,
            missingContext: params.missingContext,
            isLowConfidence: adjustedConfidence < 0.4,
            tokenUsage,
        };
    } catch (e: any) {
        console.error("[AI Hints] Failed:", e.message);
        return null;
    }
}

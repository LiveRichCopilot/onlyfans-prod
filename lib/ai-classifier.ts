/**
 * AI Fan Classifier — analyzes fan messages to detect:
 * 1. Fan type (submissive, dominant, romantic, transactional, lonely)
 * 2. Buying intent (ready_to_buy, wants_custom, price_question, etc.)
 * 3. Tone preference (playful, assertive, romantic, direct)
 * 4. Emotional drivers (validation, companionship, escapism, etc.)
 *
 * Uses GPT-5 mini for cost efficiency (~$0.0005 per classification).
 * Input: last N fan messages (text only, stripped HTML).
 * Output: structured JSON with detected signals.
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

export type ClassificationResult = {
    fanType: string | null;           // submissive, dominant, romantic, transactional, lonely
    tonePreference: string | null;    // playful, assertive, romantic, direct, calm, witty
    intentTags: IntentTag[];          // Detected buying/behavioral signals
    emotionalDrivers: string[];       // validation, companionship, escapism, entertainment, status
    buyingKeywords: string[];         // Extracted keywords indicating purchase interest
    confidence: number;               // 0-1 overall confidence
    summary: string;                  // 1-2 sentence narrative summary
};

export type IntentTag = {
    tag: string;                      // ready_to_buy, wants_custom, price_question, etc.
    confidence: number;               // 0-1
    evidence: string;                 // Short excerpt that triggered this detection
};

const SYSTEM_PROMPT = `You are an expert fan behavior analyst for an OnlyFans agency. You analyze fan messages to classify their personality, buying intent, and communication preferences.

You will receive the last 20 messages from a fan (text only). Analyze them and return a JSON object.

## Fan Types (pick ONE that best fits)
- "submissive": Uses phrases like "I'll do anything", "Tell me what to do", "Yes ma'am", seeks direction
- "dominant": Uses "I want to...", "I'm going to...", "Send me...", takes charge in conversation
- "romantic": Talks about connection, feelings, "I miss you", compliments, meeting, emotional bonding
- "transactional": Direct about purchases — "How much?", "Send me X", "What do you have?", efficiency-focused
- "lonely": Talks about his day, vents about problems, seeks emotional support, just wants someone to talk to

## Intent Tags (detect ALL that apply, with confidence 0-1)
- "ready_to_buy": Shows clear purchase intent ("I want to buy", "send it", "how do I pay")
- "wants_custom": Requests personalized content ("Can you make me...", "I want something special")
- "price_question": Asking about pricing ("How much", "What's the cost", "Is there a deal")
- "discount_request": Explicitly asking for lower price ("Can I get a discount", "Too expensive")
- "wants_more": Wants more content/access ("Show me more", "I want to see everything")
- "high_intent": Multiple buying signals in short time
- "churn_risk": Shows signs of leaving ("Might cancel", "Not worth it", "Too expensive lately")
- "escalation_intent": Wants more exclusive access ("Can we talk privately", "VIP", "special access")
- "trust_intent": Questioning authenticity ("Is this really you?", "Are you real?", "Prove it")
- "attention_intent": Wants faster/more replies ("Why aren't you responding?", "Hello??")
- "status_intent": Wants to feel special ("Do other guys get this?", "Am I your favorite?")
- "emotional_support": Venting, sharing problems, seeking comfort
- "entertainment": Just bored, wants fun, sends memes/jokes
- "boundary_testing": Pushes rules, requests prohibited content

## Emotional Drivers (pick ALL that apply)
- "validation": Seeks approval, compliments, reassurance
- "companionship": Wants someone to talk to, connection
- "escapism": Uses this as escape from real life stress
- "entertainment": Purely for fun/excitement
- "status": Wants to feel like a VIP/top fan
- "exclusivity": Wants content no one else has

## Buying Keywords
Extract specific words/phrases from messages that indicate purchase interest or content preferences.
Examples: "video", "custom", "tonight", "exclusive", "just for me", "PPV", "tip"

## Rules
- Only analyze FAN messages (not creator messages)
- If there aren't enough messages to classify, set confidence low
- Be conservative — only tag intents you're fairly sure about
- The summary should be actionable for a chatter (what to do next)

Return ONLY valid JSON matching this schema:
{
  "fanType": "string or null",
  "tonePreference": "string or null",
  "intentTags": [{ "tag": "string", "confidence": 0.0-1.0, "evidence": "short quote" }],
  "emotionalDrivers": ["string"],
  "buyingKeywords": ["string"],
  "confidence": 0.0-1.0,
  "summary": "1-2 sentence actionable summary"
}`;

/**
 * Classify a fan's messages to detect type, intent, and preferences.
 * @param fanMessages - Array of fan message texts (HTML stripped, chronological order)
 * @param fanName - Optional fan name for context
 * @returns Classification result or null if API unavailable
 */
export async function classifyFan(
    fanMessages: string[],
    fanName?: string,
): Promise<ClassificationResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("[AI Classifier] OPENAI_API_KEY not set — skipping classification");
        return null;
    }

    if (fanMessages.length === 0) {
        return null;
    }

    // Build the message context (limit to last 20 fan messages, max ~2000 chars each)
    const trimmedMessages = fanMessages
        .slice(-20)
        .map((m, i) => `[${i + 1}] ${m.slice(0, 2000)}`)
        .join("\n");

    const userPrompt = fanName
        ? `Fan "${fanName}" sent these messages:\n\n${trimmedMessages}`
        : `Fan messages:\n\n${trimmedMessages}`;

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
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 800,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[AI Classifier] OpenAI error:", response.status, errText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const result = JSON.parse(content) as ClassificationResult;

        // Validate the structure
        return {
            fanType: result.fanType || null,
            tonePreference: result.tonePreference || null,
            intentTags: Array.isArray(result.intentTags) ? result.intentTags : [],
            emotionalDrivers: Array.isArray(result.emotionalDrivers) ? result.emotionalDrivers : [],
            buyingKeywords: Array.isArray(result.buyingKeywords) ? result.buyingKeywords : [],
            confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
            summary: result.summary || "",
        };
    } catch (e: any) {
        console.error("[AI Classifier] Failed:", e.message);
        return null;
    }
}

/**
 * Strip HTML tags from message text.
 */
export function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}

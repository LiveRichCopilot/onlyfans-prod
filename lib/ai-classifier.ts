/**
 * AI Fan Classifier v2 — "scan once, remember forever"
 *
 * Analyzes fan messages using windowed fetch (early + recent) to detect:
 * 1. Fan type (submissive, dominant, romantic, transactional, lonely)
 * 2. Buying intent (ready_to_buy, wants_custom, price_question, etc.)
 * 3. Tone preference (playful, assertive, romantic, direct)
 * 4. Emotional drivers (validation, companionship, escapism, etc.)
 * 5. Personal facts (job, pets, hobbies, location, relationship, etc.)
 * 6. Suggested questions when facts are missing
 * 7. "Do not forget" bullets for chatters
 *
 * Uses GPT-4o-mini for cost efficiency (~$0.0005 per classification).
 * Budget: max 400 messages, 4-6 API calls, 20-30s runtime.
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

// --- Types ---

export type PersonalFact = {
    key: string;                      // hobby, pet_name, favorite_drink, body_preference, etc.
    value: string;                    // "gaming", "Max (golden retriever)", "Starbucks", "booty"
    confidence?: number;              // 0-1 how sure we are about this fact
    sourceMessageId?: string;         // OFAPI message ID where this was detected
};

export type IntentTag = {
    tag: string;                      // ready_to_buy, wants_custom, price_question, etc.
    confidence: number;               // 0-1
    evidence: string;                 // Short excerpt that triggered this detection
};

export type AnalysisMetadata = {
    earlyWindowCount: number;         // msgs from order=asc window
    recentWindowCount: number;        // msgs from order=desc window
    purchaseContextCount: number;     // msgs around purchases (from already-fetched set)
    totalMessagesUsed: number;        // early+recent (after dedupe)
    lastMessageIdUsed?: string;       // cursor → store as Fan.lastAnalyzedMessageId
    lastMessageAtUsed?: string;       // ISO timestamp of newest msg analyzed
    apiCallsMade: number;             // OFAPI calls made (budget tracking)
    runtimeMs: number;                // total classify duration
    isIncremental: boolean;           // true = delta update, false = first scan
};

export type ClassificationResult = {
    // --- Identity & personality ---
    fanType: string | null;           // submissive, dominant, romantic, transactional, lonely
    tonePreference: string | null;    // playful, assertive, romantic, direct, calm, witty
    emotionalDrivers: string[];       // validation, companionship, escapism, entertainment, status

    // --- Personal facts (structured top-level for UI) ---
    nickname: string | null;          // what they go by / asked to be called
    location: string | null;          // city/country/timezone if mentioned
    job: string | null;               // occupation if mentioned
    relationshipStatus: string | null; // single/married/partnered/unknown
    pets: string[];                   // ["Max (golden retriever)", "cat"]
    hobbies: string[];                // ["gaming", "gym", "travel", "basketball"]

    // --- All facts (key-value, maps directly to FanFact table) ---
    facts: PersonalFact[];            // everything extracted — DB storage format

    // --- Buying behavior ---
    intentTags: IntentTag[];          // detected buying/behavioral signals
    buyingKeywords: string[];         // words indicating purchase interest
    contentPreferences: string[];     // "booty", "feet", "lingerie", "POV", "GFE", etc.

    // --- Output for chatters ---
    confidence: number;               // 0-1 overall confidence
    summary: string;                  // 1-2 sentence actionable summary
    suggestedQuestions: string[];     // questions to ask when facts are missing
    doNotForget: string[];            // 3-8 bullet points the chatter should always remember

    // --- Analysis metadata (for UI + cursor) ---
    analysis: AnalysisMetadata;
};

// --- System prompt ---

const SYSTEM_PROMPT = `You are an expert fan behavior analyst for an OnlyFans agency. You analyze fan messages to classify their personality, buying intent, communication preferences, and extract personal facts.

You will receive messages from two windows: EARLY messages (from the start of the conversation) and RECENT messages (latest). Analyze them and return a JSON object.

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

## Personal Facts — EXTRACT EVERYTHING
Look for ANY personal details the fan mentions. Return as key-value pairs in the "facts" array AND fill the top-level fields.

Top-level fields to fill:
- "nickname": their real name or what they asked to be called
- "location": city, country, timezone clues
- "job": occupation, work schedule
- "relationshipStatus": single, married, divorced, partnered, or "unknown"
- "pets": array of pet descriptions
- "hobbies": array of interests

Also capture in "facts" array (key-value):
- pet_name, hobby, favorite_drink, work_schedule, body_preference, favorite_team, music_taste, tv_shows, age, kinks, food_preference, sports_team, birthday_month, etc.

## Content Preferences
What type of content does this fan react to or request?
Examples: "booty", "boobs", "feet", "lingerie", "nude", "tease", "POV", "JOI", "roleplay", "GFE", "dom", "sub"

## Do Not Forget
Write 3-8 bullet points that a chatter should ALWAYS remember about this fan. These are the most important things. Examples:
- "Loves when you call him daddy"
- "Works night shifts — best time to message is after 11pm"
- "Has a golden retriever named Max — always ask about Max"
- "Hates being ignored — responds to attention quickly"
- "Big tipper when he's drunk on weekends"

## Suggested Questions
If you CANNOT find certain facts (job, location, relationship status, pets, hobbies), generate 1-3 casual questions the chatter could ask to fill the gaps. Make them natural, not interrogating.
Examples:
- "What do you do for work babe?"
- "Are you single or is someone gonna get jealous? 😏"
- "Do you have any pets? I love animals"
- "What shows are you watching lately?"

## Rules
- Only analyze FAN messages (not creator messages)
- Messages marked [PURCHASED $X] or [TIPPED] indicate actual purchases — note the behavior
- If there aren't enough messages to classify, set confidence low
- Be conservative with intent tags — only tag if fairly sure
- Be AGGRESSIVE with personal facts — capture EVERYTHING they reveal
- The summary should be actionable for a chatter (what to do next)
- For "unknown" fields, set to null (not the string "unknown")
- Always return suggestedQuestions for any missing key fact (job, location, relationship, hobbies)

Return ONLY valid JSON matching this schema:
{
  "fanType": "string or null",
  "tonePreference": "string or null",
  "emotionalDrivers": ["string"],
  "nickname": "string or null",
  "location": "string or null",
  "job": "string or null",
  "relationshipStatus": "string or null",
  "pets": ["string"],
  "hobbies": ["string"],
  "facts": [{ "key": "string", "value": "string" }],
  "intentTags": [{ "tag": "string", "confidence": 0.0-1.0, "evidence": "short quote" }],
  "buyingKeywords": ["string"],
  "contentPreferences": ["string"],
  "confidence": 0.0-1.0,
  "summary": "1-2 sentence actionable summary",
  "suggestedQuestions": ["string"],
  "doNotForget": ["string"]
}`;

/**
 * Classify a fan's messages to detect type, intent, preferences, and personal facts.
 * @param fanMessages - Array of fan message texts (HTML stripped, chronological order)
 * @param fanName - Optional fan name for context
 * @param existingFacts - Previously stored facts (so the agent doesn't redo work)
 * @returns Classification result or null if API unavailable
 */
export async function classifyFan(
    fanMessages: string[],
    fanName?: string,
    existingFacts?: PersonalFact[],
    timeoutMs?: number,
): Promise<Omit<ClassificationResult, "analysis"> | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("[AI Classifier] OPENAI_API_KEY not set — skipping classification");
        return null;
    }

    if (fanMessages.length === 0) {
        return null;
    }

    // Budget: max 200 messages to GPT (GPT-4o-mini has 128K context)
    const maxMsgs = Math.min(fanMessages.length, 200);
    const trimmedMessages = fanMessages
        .slice(-maxMsgs)
        .map((m, i) => `[${i + 1}] ${m.slice(0, 500)}`) // Truncate each to 500 chars
        .join("\n");

    // Build user prompt with context
    let userPrompt = fanName
        ? `Fan "${fanName}" sent these messages:\n\n${trimmedMessages}`
        : `Fan messages:\n\n${trimmedMessages}`;

    // If we have existing facts, tell the agent so it doesn't redo work
    if (existingFacts && existingFacts.length > 0) {
        const existingStr = existingFacts.map(f => `${f.key}: ${f.value}`).join("\n");
        userPrompt += `\n\n--- EXISTING FACTS (already known, update only if new info contradicts or adds detail) ---\n${existingStr}`;
    }

    try {
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), timeoutMs || 12000);

        const response = await fetch(OPENAI_BASE, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.2,
                max_tokens: 1200, // Expanded for doNotForget + suggestedQuestions + facts
                response_format: { type: "json_object" },
            }),
            signal: controller.signal,
        }).finally(() => clearTimeout(abortTimer));

        if (!response.ok) {
            const errText = await response.text();
            console.error("[AI Classifier] OpenAI error:", response.status, errText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const raw = JSON.parse(content);

        // Validate + default all fields (LLM may omit arrays)
        return {
            fanType: raw.fanType || null,
            tonePreference: raw.tonePreference || null,
            emotionalDrivers: Array.isArray(raw.emotionalDrivers) ? raw.emotionalDrivers : [],
            nickname: raw.nickname || null,
            location: raw.location || null,
            job: raw.job || null,
            relationshipStatus: raw.relationshipStatus || null,
            pets: Array.isArray(raw.pets) ? raw.pets : [],
            hobbies: Array.isArray(raw.hobbies) ? raw.hobbies : [],
            facts: Array.isArray(raw.facts) ? raw.facts : [],
            intentTags: Array.isArray(raw.intentTags) ? raw.intentTags : [],
            buyingKeywords: Array.isArray(raw.buyingKeywords) ? raw.buyingKeywords : [],
            contentPreferences: Array.isArray(raw.contentPreferences) ? raw.contentPreferences : [],
            confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
            summary: raw.summary || "",
            suggestedQuestions: Array.isArray(raw.suggestedQuestions) ? raw.suggestedQuestions : [],
            doNotForget: Array.isArray(raw.doNotForget) ? raw.doNotForget : [],
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

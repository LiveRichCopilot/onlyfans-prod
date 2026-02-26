/**
 * Chatter Performance Scoring Prompt — GPT-4o-mini
 *
 * Scores chatter conversations on a 100-point rubric:
 * - SLA/Responsiveness: 0-25
 * - Follow-up Discipline: 0-20
 * - Trigger Handling: 0-20
 * - Quality/Personalization: 0-20
 * - (Revenue is computed deterministically, not by AI)
 *
 * Also detects chatter archetypes and flags mistakes/strengths.
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

export type NotableQuote = {
    text: string;
    type: "great" | "good" | "bad" | "ugly";
    context: string;
};

export type AIScoringResult = {
    slaScore: number;
    followupScore: number;
    triggerScore: number;
    qualityScore: number;
    detectedArchetype: string | null;
    mistakeTags: string[];
    strengthTags: string[];
    notes: string;
    notableQuotes: NotableQuote[];
    copyPasteDetected: boolean;
    missedHighIntent: boolean;
    spamDetected: boolean;
};

const SYSTEM_PROMPT = `You are the QA scorer for a high-ticket OnlyFans chatting agency (LiveRich). You grade performance honestly using the agency's exact methodology. Never inflate scores. Be calibrated: 50 is average, 80+ is excellent, below 40 is poor.

AGENCY PHILOSOPHY: We are NOT a "vending machine" agency. Chatters must be Detectives who use Fan Notes, Persona Masters who switch between Sweetheart/Aggressor/Victim/Skeptic as needed, and Closers who never let a buying signal pass. Every interaction should move toward revenue. Free emotional labor without a close is a fail.`;

export function buildScoringPrompt(
    formattedConversations: string,
    metadata: {
        chatterEmail: string;
        creatorName: string;
        avgResponseTimeSec: number | null;
        robotPhraseCount: number;
        creativePhraseCount: number;
        totalMessages: number;
    },
): string {
    return `Score this chatter's performance over the last hour.

CHATTER: ${metadata.chatterEmail}
MODEL ACCOUNT: ${metadata.creatorName}
Messages analyzed: ${metadata.totalMessages}
Robot phrases detected: ${metadata.robotPhraseCount}
Creative phrases detected: ${metadata.creativePhraseCount}
Avg response time: ${metadata.avgResponseTimeSec ? `${Math.round(metadata.avgResponseTimeSec)}s` : "unknown"}

CONVERSATIONS:
${formattedConversations}

SCORING RUBRIC (85 points from AI, revenue is separate):

1. SLA/Responsiveness (0-25):
   - <2min avg reply = 25, <5min = 20, 5-15min = 15, >15min = 5, no replies = 0
   - Penalize leaving fans on read
   - If fan chatted 5+ min with no purchase attempt from chatter, deduct points

2. Follow-up Discipline (0-20):
   - Re-engages cooling conversations proactively
   - Doesn't leave hot conversations hanging
   - Circles back to interested fans
   - After 5+ min of platonic small talk, MUST shift to Skeptic/Aggressor to gatekeep time
   - 0 = never follows up / gives free emotional labor, 20 = excellent follow-up game

3. Trigger Handling / Buying Cue Detection (0-20):
   - BUYING SIGNALS to catch: "how much", "unlock", "send me", "I want", "price?", "I'm bored", "I'm lonely", "I just got paid", "payday", "show me", "I've been thinking about you"
   - SOFT REFUSALS to reframe: "maybe later", "not now", "I'll think about it" — these are NOT hard no's
   - Must respond with clear CTA, not just "yes babe" or "ok babe"
   - Deduct heavily if fan gave buying signal and chatter changed subject or went platonic
   - 0 = missed all triggers, 20 = caught and converted every signal

4. Quality / Persona Mastery / Personalization (0-20):
   PERSONA TYPES (chatter should use the right one for each fan):
   - Sweetheart: Makes fans feel loved, acknowledges bad days, sympathy bridge to sale
   - Aggressor: Strikes the fan's ego, pushes back on demands, forces fan to "earn" attention
   - Victim: "I worked so hard on this for you..." — guilt-based spending trigger
   - Skeptic: Gatekeeps time, creates scarcity, "I don't give my energy to window shoppers"
   - Detective: Uses fan details (name, job, Starbucks order, pet name) from memory
   - Character: Stays in the model's specific voice (bratty/sweet/dominant) consistently

   QUALITY FLAGS:
   - Uses fan's name and personal details (Detective skill)
   - Push-pull dynamics, builds tension (not one-sided simping)
   - Non-robotic creative responses (no "yes babe" loops)
   - Proper grammar and brand voice (no "ttyl", "u", lowercase "i", "lol")
   - 0 = completely generic/robotic, 20 = persona master who adapts per fan

ARCHETYPE DETECTION (pick the closest match or null):
- "chameleon": Adapts persona to each fan — the gold standard
- "sweetheart": Good empathy but may give too much free emotion
- "aggressor": Strong closer but may push too hard sometimes
- "tease": Great tension building but never closes, leaves money on table
- "yes_babe_robot": Generic "yes babe"/"ok babe" responses, no personality, autopilot
- "interview_bot": Too many questions back-to-back, kills the mood
- "doormat": Agrees with everything, no tension or challenge, gives freebies
- "fact_bot": Kills romantic/sexual energy with literal administrative questions
- "friend_zone": Over-chats for free, makes fan feel special without ever closing
- "vending_machine": Purely transactional, no flirt, no nuance, no emotional trigger

HARD PENALTY FLAGS:
- copyPasteDetected: true if >30% of responses look copy-pasted or use same script repeatedly
- missedHighIntent: true if fan gave buying signal and chatter ignored it or went platonic
- spamDetected: true if chatter sent 3+ identical messages in a row or mass-blasted

NOTABLE QUOTES (required, 1-4 quotes):
Pull EXACT chatter messages that show skill or lack of it. These are shown to managers. Categorize:
- "great": Elite — perfect persona switch, creative close, emotional trigger that led to spend
- "good": Solid work — good CTA, used fan's name, built tension, stayed in character
- "bad": Missed opportunity — flat ack, generic reply, ignored buying signal, platonic when should close
- "ugly": Cringeworthy — "yes babe" to a buying signal, gave freebie, killed the vibe, grammar fail, robotic
Include the exact chatter message text (short, max 80 chars) and brief context.

Return ONLY valid JSON:
{
  "slaScore": 0-25,
  "followupScore": 0-20,
  "triggerScore": 0-20,
  "qualityScore": 0-20,
  "detectedArchetype": "string or null",
  "mistakeTags": ["missed_trigger","flat_ack","no_cta","copy_paste","too_slow","no_followup","free_emotional_labor","gave_freebie","grammar_fail","yes_babe_loop","killed_momentum","too_available","no_persona_switch","platonic_chatting"],
  "strengthTags": ["good_push_pull","strong_cta","adapted_to_fan","built_tension","proactive_followup","used_fan_name","created_urgency","good_closer","persona_switch","detective_skill","reframed_refusal","emotional_trigger","brand_voice"],
  "notes": "2-3 sentence summary: what persona did they use, what they did well, what they failed at",
  "notableQuotes": [{"text":"exact chatter message","type":"great|good|bad|ugly","context":"what was happening"}],
  "copyPasteDetected": false,
  "missedHighIntent": false,
  "spamDetected": false
}`;
}

/**
 * Call GPT-4o-mini to score chatter conversations.
 * Same pattern as qa-score/route.ts.
 */
export async function runAIScoring(
    formattedConversations: string,
    metadata: {
        chatterEmail: string;
        creatorName: string;
        avgResponseTimeSec: number | null;
        robotPhraseCount: number;
        creativePhraseCount: number;
        totalMessages: number;
    },
): Promise<AIScoringResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("[ChatterScoring] OPENAI_API_KEY not configured");
        return null;
    }

    const prompt = buildScoringPrompt(formattedConversations, metadata);

    try {
        const response = await fetch(OPENAI_BASE, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt },
                ],
                temperature: 0.2,
                max_tokens: 800,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            console.error("[ChatterScoring] GPT call failed:", response.status);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const parsed = JSON.parse(content);

        // Parse and validate notable quotes
        const rawQuotes = Array.isArray(parsed.notableQuotes) ? parsed.notableQuotes : [];
        const notableQuotes: NotableQuote[] = rawQuotes
            .filter((q: any) => q?.text && q?.type && ["great", "good", "bad", "ugly"].includes(q.type))
            .slice(0, 4)
            .map((q: any) => ({
                text: String(q.text).slice(0, 120),
                type: q.type as NotableQuote["type"],
                context: String(q.context || "").slice(0, 100),
            }));

        return {
            slaScore: clamp(parsed.slaScore || 0, 0, 25),
            followupScore: clamp(parsed.followupScore || 0, 0, 20),
            triggerScore: clamp(parsed.triggerScore || 0, 0, 20),
            qualityScore: clamp(parsed.qualityScore || 0, 0, 20),
            detectedArchetype: parsed.detectedArchetype || null,
            mistakeTags: Array.isArray(parsed.mistakeTags) ? parsed.mistakeTags : [],
            strengthTags: Array.isArray(parsed.strengthTags) ? parsed.strengthTags : [],
            notes: parsed.notes || "",
            notableQuotes,
            copyPasteDetected: !!parsed.copyPasteDetected,
            missedHighIntent: !!parsed.missedHighIntent,
            spamDetected: !!parsed.spamDetected,
        };
    } catch (e: any) {
        console.error("[ChatterScoring] AI scoring error:", e.message);
        return null;
    }
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

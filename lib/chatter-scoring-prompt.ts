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

const SYSTEM_PROMPT = `You are an expert QA scorer for an OnlyFans chatting agency. You grade chatter performance honestly and specifically. Never inflate scores. Be calibrated: 50 is average, 80+ is excellent, below 40 is poor.`;

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

2. Follow-up Discipline (0-20):
   - Re-engages cooling conversations proactively
   - Doesn't leave hot conversations hanging
   - Circles back to interested fans
   - 0 = never follows up, 20 = excellent follow-up game

3. Trigger Handling (0-20):
   - Catches buying signals: "how much", "unlock", "send me", "I want", "price?"
   - Responds to triggers with clear CTA (not just "yes babe")
   - 0 = missed all triggers, 20 = caught and converted every signal

4. Quality/Personalization (0-20):
   - Uses fan's name and personal details
   - Adapts tone to each fan (not one-size-fits-all)
   - Push-pull dynamics, builds tension
   - Non-robotic, creative responses
   - 0 = completely generic, 20 = deeply personalized

ARCHETYPE DETECTION (pick the closest match or null):
- "yes_babe_robot": Generic "yes babe" responses, no personality, autopilot
- "interview_bot": Too many questions back-to-back, kills the mood
- "doormat": Agrees with everything, no tension or challenge
- "commander": Too aggressive, doesn't read the room, pushes too hard
- "tease": Great tension building but never closes, leaves money on table
- "chameleon": Adapts style to each fan type — the gold standard

HARD PENALTY FLAGS:
- copyPasteDetected: true if >30% of responses look copy-pasted (identical or near-identical)
- missedHighIntent: true if fan said "how much", "send me", "I want to buy" and chatter ignored it
- spamDetected: true if chatter sent 3+ identical messages in a row or mass-blasted

NOTABLE QUOTES (required, 1-4 quotes):
Pull actual chatter messages that show skill or lack of skill. Categorize each:
- "great": Elite-level message — perfect push-pull, creative, made the fan spend
- "good": Solid professional work — good CTA, personalized, on-brand
- "bad": Missed opportunity or lazy response — flat ack, generic, ignored signal
- "ugly": Cringeworthy — robotic, begging, killed the vibe, lost money
Include the exact chatter message text (short, max 80 chars) and brief context of what happened.

Return ONLY valid JSON:
{
  "slaScore": 0-25,
  "followupScore": 0-20,
  "triggerScore": 0-20,
  "qualityScore": 0-20,
  "detectedArchetype": "string or null",
  "mistakeTags": ["missed_trigger","flat_ack","no_cta","copy_paste","too_slow","no_followup","permission_asking","begging","too_available"],
  "strengthTags": ["good_push_pull","strong_cta","adapted_to_fan","built_tension","proactive_followup","used_fan_name","created_urgency","good_closer"],
  "notes": "2-3 sentence summary of performance",
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
                max_tokens: 600,
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

/**
 * Chatter Story Analyzer — Kimi K2.5 (Moonshot AI)
 *
 * Analyzes conversations for selling technique patterns, story arcs,
 * and labels key moments (STORY_START, BUYING_SIGNAL, SELL, etc.).
 *
 * Runs as a second AI call after the main scoring prompt.
 * Uses Kimi K2.5 for its 262K context and thinking capabilities.
 */

const KIMI_BASE = "https://api.moonshot.ai/v1/chat/completions";

// --- Types ---

export type MessageLabel = {
    messageIndex: number;
    label: string;
    sublabel?: string;
    isSellMessage: boolean;
};

export type PatternStep = {
    description: string;
    achieved: boolean;
    messageRef?: number;
};

export type StoryArc = {
    title: string;
    messageRange: [number, number];
    messageLabels: MessageLabel[];
    sellCount: number;
    sellQuotes: string[];
    storyFlowAnalysis: string;
    fanInvestment: string;
    keyElements: string[];
    sellingPattern: PatternStep[];
};

export type StoryAnalysis = {
    storyArcs: StoryArc[];
    overallSellingScore: number;
    fanInvestmentMoment: string | null;
};

// --- Prompt ---

const STORY_SYSTEM_PROMPT = `You are an expert OnlyFans agency QA analyst specializing in selling technique analysis.

You analyze chatter-fan conversations to identify STORY ARCS and SELLING PATTERNS.

## Your Task
Given a conversation between a CHATTER (the agency employee) and a FAN, you must:

1. IDENTIFY STORY ARCS — contiguous sequences of themed messages that form a narrative (e.g., a fantasy scenario, a roleplay, a build-up to a sale)
2. LABEL KEY MESSAGES — tag important moments with labels
3. ANALYZE SELLING PATTERNS — how the chatter embedded sells into the conversation flow

## Message Labels (use these exact strings)
- STORY_START — beginning of a narrative/fantasy arc
- STORY_END — natural conclusion of a story arc
- BUYING_SIGNAL — fan shows interest in purchasing (e.g., "show me", "I want", "send it", emotional investment)
- SELL — chatter attempts to sell content (embedded or direct). Number them: SELL #1, SELL #2, etc.
- EMOTIONAL_HOOK — chatter creates emotional connection ("I've never felt this way before", exclusivity)
- PEAK_ENGAGEMENT — fan is at maximum emotional investment
- VISUAL_SETUP — chatter paints a vivid scene ("imagine...")
- SENSORY_PACING — chatter uses sensory language to build tension
- FAN_INVESTED — moment when fan becomes deeply invested (writing own fantasy, long responses)
- SOFT_SELL — gentle sell attempt disguised as part of the story

## Selling Pattern Checklist
There are TWO valid selling approaches. Evaluate which the chatter used:

**APPROACH A: Buying Signal → Immediate Sell (BEST when fan signals intent)**
When a fan gives a buying signal ("show me", "I want to see", "send it"), the correct move is to sell IMMEDIATELY. Do NOT penalize fast sells after buying signals — that's perfect execution.
1. Fan gives buying signal (request, desire, curiosity)
2. Chatter responds with sell IMMEDIATELY (within 1-2 messages) ← THIS IS CORRECT
3. Sell matches what the fan asked for (relevant content)
4. Follow-up after sell to keep engagement alive
5. Look for next opportunity

**APPROACH B: Story Arc → Embedded Sell (when no buying signal yet)**
When no buying signal exists, the chatter should build interest first:
1. Start with "imagine" / visual setup
2. Build 2-3 story messages to create desire
3. Sell embedded naturally in story flow
4. Continue engagement after sell
5. Drop emotional hook for next opportunity

CRITICAL: If a fan explicitly asks for content or signals buying intent, and the chatter sells immediately — that is a PERFECT sell, NOT a mistake. Score it highly. The worst thing a chatter can do is ignore a buying signal to "build more story".

## Output Format
Return valid JSON only. No markdown wrapping.

{
  "storyArcs": [
    {
      "title": "Short descriptive title of the arc",
      "messageRange": [startIndex, endIndex],
      "messageLabels": [
        { "messageIndex": 0, "label": "STORY_START", "sublabel": null, "isSellMessage": false },
        { "messageIndex": 5, "label": "SELL", "sublabel": "SELL WITHIN STORY", "isSellMessage": true }
      ],
      "sellCount": 2,
      "sellQuotes": ["exact chatter sell message text"],
      "storyFlowAnalysis": "Brief analysis of whether sells broke the narrative",
      "fanInvestment": "Description of when/how the fan became invested",
      "keyElements": ["kitchen setting", "imagine visual setup"],
      "sellingApproach": "A_BUYING_SIGNAL or B_STORY_ARC",
      "sellingPattern": [
        { "description": "Fan gave buying signal", "achieved": true, "messageRef": 5 },
        { "description": "Chatter sold immediately after signal", "achieved": true, "messageRef": 6 }
      ]
    }
  ],
  "overallSellingScore": 85,
  "fanInvestmentMoment": "By message #12 fan is writing own fantasy"
}

IMPORTANT:
- messageIndex is 0-based relative to the conversation messages array
- Only label messages that have significance (most will have none)
- If no clear story arc exists, return empty storyArcs array
- overallSellingScore: 0-100 rating of the chatter's selling technique
- Be concise in analysis text (1-2 sentences each)`;

/**
 * Run story analysis on a formatted conversation.
 * Uses Kimi K2.5 with thinking disabled for structured JSON output.
 */
export async function runStoryAnalysis(
    formattedConversation: string,
    messageCount: number,
): Promise<StoryAnalysis | null> {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) {
        console.warn("[StoryAnalysis] MOONSHOT_API_KEY not configured, skipping");
        return null;
    }

    if (messageCount < 8) {
        return null; // Not enough messages for story analysis
    }

    try {
        const response = await fetch(KIMI_BASE, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "kimi-k2.5",
                messages: [
                    { role: "system", content: STORY_SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: `Analyze this conversation for story arcs and selling patterns:\n\n${formattedConversation}`,
                    },
                ],
                thinking: { type: "disabled" },
                max_tokens: 4096,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            console.error("[StoryAnalysis] Kimi API error:", response.status, errText.slice(0, 300));
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            console.warn("[StoryAnalysis] Kimi returned no content");
            return null;
        }

        const parsed = JSON.parse(content);
        return validateStoryAnalysis(parsed);
    } catch (e: any) {
        console.error("[StoryAnalysis] Error:", e.message);
        return null;
    }
}

/**
 * Validate and sanitize the AI response into a clean StoryAnalysis object.
 */
function validateStoryAnalysis(raw: any): StoryAnalysis {
    const storyArcs: StoryArc[] = [];

    if (Array.isArray(raw.storyArcs)) {
        for (const arc of raw.storyArcs.slice(0, 5)) {
            const labels: MessageLabel[] = [];
            if (Array.isArray(arc.messageLabels)) {
                for (const l of arc.messageLabels.slice(0, 30)) {
                    labels.push({
                        messageIndex: typeof l.messageIndex === "number" ? l.messageIndex : 0,
                        label: String(l.label || ""),
                        sublabel: l.sublabel ? String(l.sublabel) : undefined,
                        isSellMessage: Boolean(l.isSellMessage),
                    });
                }
            }

            const pattern: PatternStep[] = [];
            if (Array.isArray(arc.sellingPattern)) {
                for (const p of arc.sellingPattern.slice(0, 10)) {
                    pattern.push({
                        description: String(p.description || ""),
                        achieved: Boolean(p.achieved),
                        messageRef: typeof p.messageRef === "number" ? p.messageRef : undefined,
                    });
                }
            }

            storyArcs.push({
                title: String(arc.title || "Untitled Arc"),
                messageRange: Array.isArray(arc.messageRange) ? [arc.messageRange[0] || 0, arc.messageRange[1] || 0] : [0, 0],
                messageLabels: labels,
                sellCount: typeof arc.sellCount === "number" ? arc.sellCount : 0,
                sellQuotes: Array.isArray(arc.sellQuotes) ? arc.sellQuotes.map(String).slice(0, 5) : [],
                storyFlowAnalysis: String(arc.storyFlowAnalysis || ""),
                fanInvestment: String(arc.fanInvestment || ""),
                keyElements: Array.isArray(arc.keyElements) ? arc.keyElements.map(String).slice(0, 8) : [],
                sellingPattern: pattern,
            });
        }
    }

    return {
        storyArcs,
        overallSellingScore: typeof raw.overallSellingScore === "number"
            ? Math.max(0, Math.min(100, raw.overallSellingScore)) : 0,
        fanInvestmentMoment: raw.fanInvestmentMoment ? String(raw.fanInvestmentMoment) : null,
    };
}

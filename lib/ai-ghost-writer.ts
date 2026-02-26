/**
 * AI Chameleon Ghost-Writer
 *
 * Rewrites messages in different character tones.
 * Uses GPT-4o-mini for cost efficiency.
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

export type GhostWriteTone = "the_tease" | "the_commander" | "the_girlfriend" | "the_brat" | "the_sweet";

export const TONE_CONFIGS: Record<GhostWriteTone, { label: string; emoji: string; description: string; prompt: string }> = {
    the_tease: {
        label: "The Tease",
        emoji: "😏",
        description: "Playful, suggestive, always leaving them wanting more",
        prompt: "Rewrite as a flirty tease — playful, suggestive, leaving them wanting more. Use tension and mystery. Never be too available.",
    },
    the_commander: {
        label: "The Commander",
        emoji: "👸",
        description: "Dominant, confident, in control",
        prompt: "Rewrite as a dominant commander — confident, in control, slightly demanding. Make them feel like they need to earn your attention.",
    },
    the_girlfriend: {
        label: "The Girlfriend",
        emoji: "💕",
        description: "Sweet, caring, emotionally intimate",
        prompt: "Rewrite as a sweet girlfriend — warm, caring, emotionally intimate. Make them feel special and connected, like you genuinely care.",
    },
    the_brat: {
        label: "The Brat",
        emoji: "😈",
        description: "Sassy, challenging, push-pull",
        prompt: "Rewrite as a sassy brat — witty, challenging, push-pull energy. Tease them, be slightly difficult, make them chase you.",
    },
    the_sweet: {
        label: "The Sweet",
        emoji: "🥰",
        description: "Soft, appreciative, gentle",
        prompt: "Rewrite as soft and sweet — gentle, appreciative, wholesome with a hint of flirty. Make them feel valued and comfortable.",
    },
};

/**
 * Rewrite a message in a specific character tone.
 */
export async function rewriteMessage(
    text: string,
    tone: GhostWriteTone,
    fanContext?: {
        fanName?: string;
        fanType?: string;
        stage?: string;
    },
): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const toneConfig = TONE_CONFIGS[tone];
    if (!toneConfig) return null;

    const contextStr = fanContext
        ? `\nFan info: ${fanContext.fanName || "Anonymous"}, type: ${fanContext.fanType || "unknown"}, stage: ${fanContext.stage || "unknown"}`
        : "";

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
                    {
                        role: "system",
                        content: `You are an OnlyFans creator ghost-writer. ${toneConfig.prompt}\n\nRules:\n- Keep it under 40 words\n- Be natural, not scripted\n- Maintain the original intent/meaning\n- Don't add emojis unless the original had them\n- Return ONLY the rewritten message, nothing else${contextStr}`,
                    },
                    {
                        role: "user",
                        content: `Rewrite this message:\n"${text}"`,
                    },
                ],
                temperature: 0.7,
                max_completion_tokens: 100,
            }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const rewritten = data.choices?.[0]?.message?.content?.trim();

        // Strip quotes if GPT wrapped it
        return rewritten?.replace(/^["']|["']$/g, "") || null;
    } catch (e: any) {
        console.error("[Ghost Writer] Failed:", e.message);
        return null;
    }
}

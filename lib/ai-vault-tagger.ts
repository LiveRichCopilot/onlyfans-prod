/**
 * AI Vault Tagger — tags vault media with theme, intensity, price band.
 *
 * Uses GPT-4o (OpenAI Vision) to analyze vault media and assign tags
 * matching FanPreference vocabulary.
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

export type VaultTagResult = {
    tags: string[];        // ["lingerie", "tease", "bedroom", "soft_light"]
    priceBand: "low" | "mid" | "high" | "premium";
    intensity: "tease" | "soft" | "medium" | "explicit";
    description: string;   // Short description for matching
};

const TAG_PROMPT = `You are a content tagger for an OnlyFans vault. Analyze this media and return a JSON object.

## Tags (pick ALL that apply from this vocabulary)
Content themes: lingerie, bikini, nude, topless, implied_nude, clothed, cosplay, gym, outdoor, bedroom, bathroom, shower, pool, car, mirror_selfie, pov, joi, roleplay, gfe, tease, booty, boobs, feet, full_body, face_close, behind_scenes, couple, bdsm, latex, stockings

## Price Band
- "low": Simple selfie, low production, casual
- "mid": Good lighting, intentional pose, some effort
- "high": Professional quality, styled, high effort
- "premium": Studio quality, unique concept, ultra-high effort

## Intensity
- "tease": Fully/mostly clothed, suggestive poses only
- "soft": Partially undressed, no explicit content
- "medium": Significant nudity, explicit poses
- "explicit": Fully explicit content

Return ONLY valid JSON:
{
  "tags": ["string"],
  "priceBand": "low|mid|high|premium",
  "intensity": "tease|soft|medium|explicit",
  "description": "1 sentence description for matching"
}`;

/**
 * Tag a vault media file using GPT-4o vision.
 */
export async function tagVaultMedia(
    mediaBuffer: Buffer,
    mimeType: string,
): Promise<VaultTagResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("[Vault Tagger] No OPENAI_API_KEY set");
        return null;
    }

    try {
        const base64 = mediaBuffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64}`;

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
                        role: "user",
                        content: [
                            { type: "text", text: TAG_PROMPT },
                            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
                        ],
                    },
                ],
                temperature: 0.2,
                max_completion_tokens: 300,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[Vault Tagger] OpenAI error:", response.status, errText);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const parsed = JSON.parse(content);

        return {
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            priceBand: ["low", "mid", "high", "premium"].includes(parsed.priceBand) ? parsed.priceBand : "mid",
            intensity: ["tease", "soft", "medium", "explicit"].includes(parsed.intensity) ? parsed.intensity : "soft",
            description: parsed.description || "",
        };
    } catch (e: any) {
        console.error("[Vault Tagger] Failed:", e.message);
        return null;
    }
}

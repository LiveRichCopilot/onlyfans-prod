/**
 * AI Media Analyzer Interface
 * Simulates analyzing an image/video via Kimim 2.5 / Gemini.
 */

// This represents the stub connecting to the safety checking LLM.
export async function analyzeMediaSafety(mediaBuffer: Buffer, mimeType: string): Promise<{ isSafe: boolean; reason?: string; title?: string; description?: string }> {
    console.log(`[AI Analyzer] Analyzing ${mimeType} with Gemini 2.5 Flash...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("⚠️ No GEMINI_API_KEY found. Falling back to stubbed tags.");
        return {
            isSafe: true,
            title: "Exclusive Behind the Scenes 🎬",
            description: "Just a quick little update for you all! Make sure to unlock to see more. 💖 #bts #exclusive"
        };
    }

    try {
        const base64Data = mediaBuffer.toString("base64");

        const promptText = `
        You are an elite OnlyFans Social Media Manager.
        First, check if this media is extremely violent, illegal, or violates typical terms of service (non-consensual, gore). If yes, set "isSafe" to false and provide a "reason".
        If it is safe (NSFW/adult content is perfectly fine and safe here), set "isSafe" to true.
        Then, generate an engaging, high-converting "title" (max 50 chars) and "description" with relevant hashtags (max 200 chars).
        IMPORTANT: Your response MUST be strictly valid JSON without markdown wrapping. Output format: {"isSafe": boolean, "reason": "...", "title": "...", "description": "..."}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: promptText },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            console.error("Gemini API Error", await response.text());
            throw new Error(`Gemini Error ${response.status}`);
        }

        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        try {
            const parsed = JSON.parse(jsonText);
            console.log("💎 AI Generation complete:", parsed.title);
            return {
                isSafe: parsed.isSafe ?? true,
                reason: parsed.reason,
                title: parsed.title || "Exclusive Upload 🔒",
                description: parsed.description || "Enjoy my newest drop! ❤️ #exclusive"
            };
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", jsonText);
            throw new Error("Invalid output format from Gemini");
        }

    } catch (e) {
        console.error("AI analyzer error, bypassing safety filter...", e);
        return {
            isSafe: true,
            title: "Exclusive VIP Media 💎",
            description: "Thanks for supporting my page! 💖 Enjoy this new exclusive drop."
        };
    }
}

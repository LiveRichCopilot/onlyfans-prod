/**
 * AI-powered screenshot analysis using GPT-5-mini vision.
 * Classifies what a chatter is doing in each Hubstaff screenshot.
 */

export type ScreenshotAnalysis = {
  screenshotId: number;
  timestamp: string;
  app: string;
  activity: "chatting" | "browsing" | "idle" | "social_media" | "video" | "other";
  onOnlyFans: boolean;
  description: string;
  flagged: boolean;
};

const SYSTEM_PROMPT = `You are analyzing a work screenshot from an OnlyFans chatting agency. The employee should be actively chatting with fans on the OnlyFans platform. Classify what you see.

Respond with valid JSON only:
{
  "app": "application or website name visible (e.g. OnlyFans, YouTube, Instagram, Chrome, Slack, Desktop)",
  "activity": "chatting" | "browsing" | "idle" | "social_media" | "video" | "other",
  "onOnlyFans": true/false,
  "description": "Brief 1-sentence description of what is on screen"
}

Rules:
- "chatting" = actively typing or reading messages in a chat interface
- "browsing" = navigating web pages, searching, reading articles
- "idle" = desktop, lock screen, screensaver, or blank/unchanged screen
- "social_media" = Instagram, Twitter/X, TikTok, Facebook, Reddit feed
- "video" = YouTube, Netflix, Twitch, or any video playing
- "other" = anything that does not fit the above categories`;

async function analyzeOne(screenshotUrl: string): Promise<{
  app: string;
  activity: ScreenshotAnalysis["activity"];
  onOnlyFans: boolean;
  description: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Classify this work screenshot:" },
            { type: "image_url", image_url: { url: screenshotUrl, detail: "low" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[screenshot-analyzer] OpenAI error:", res.status, text);
    return { app: "Unknown", activity: "other", onOnlyFans: false, description: "Analysis failed" };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      app: parsed.app || "Unknown",
      activity: parsed.activity || "other",
      onOnlyFans: !!parsed.onOnlyFans,
      description: parsed.description || "",
    };
  } catch {
    return { app: "Unknown", activity: "other", onOnlyFans: false, description: "Parse error" };
  }
}

/**
 * Analyze a batch of screenshots with AI vision.
 * Samples evenly across the array, max 20 screenshots.
 * Processes in parallel batches of 5 to avoid rate limits.
 */
export async function analyzeScreenshots(
  screenshots: { id: number; url: string; recorded_at: string }[]
): Promise<ScreenshotAnalysis[]> {
  if (screenshots.length === 0) return [];

  // Sample evenly, max 20 — always include first and last
  const maxSamples = 20;
  let sampled: typeof screenshots;

  if (screenshots.length <= maxSamples) {
    sampled = screenshots;
  } else {
    const step = (screenshots.length - 1) / (maxSamples - 1);
    const indices = new Set<number>();
    indices.add(0);
    indices.add(screenshots.length - 1);
    for (let i = 0; i < maxSamples; i++) {
      indices.add(Math.round(i * step));
    }
    sampled = [...indices].sort((a, b) => a - b).map(i => screenshots[i]);
  }

  const results: ScreenshotAnalysis[] = [];
  const batchSize = 5;

  for (let i = 0; i < sampled.length; i += batchSize) {
    const batch = sampled.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (ss) => {
        const analysis = await analyzeOne(ss.url);
        const flagged = !analysis.onOnlyFans || analysis.activity === "idle";
        return {
          screenshotId: ss.id,
          timestamp: ss.recorded_at,
          app: analysis.app,
          activity: analysis.activity,
          onOnlyFans: analysis.onOnlyFans,
          description: analysis.description,
          flagged,
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

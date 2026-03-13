/**
 * Content Intel Scanner — Kimi K2.5 Powered
 *
 * Scans unprocessed OutboundCreative rows (mediaCount > 0) with engagement.
 * Analyzes hook quality, tactic tags, what works vs doesn't.
 * Writes insights to ContentInsight (keyed by creativeId). Stateless.
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KIMI_BASE = "https://api.moonshot.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a content performance analyst for an OnlyFans agency. You analyze mass messages and evaluate what makes hooks effective.

For each message, assign:
- id: the EXACT id string provided (copy it verbatim)
- tacticTag: primary tactic (tease, urgency, curiosity, personal, value_frame, exclusivity, scarcity, emotional, social_proof, direct_offer)
- hookQuality: 0-100 score
- insight: one sentence on why this hook works or doesn't

Return JSON:
{
  "results": [
    { "id": "abc123", "tacticTag": "tease", "hookQuality": 75, "insight": "Strong curiosity opener but weak CTA" }
  ],
  "patterns": "2-3 sentence summary of overall patterns"
}

Be specific. "Good hook" is useless. "Opens with question creating information gap" is useful.
CRITICAL: The "id" field must be copied EXACTLY from the input — do not modify, truncate, or reformat it.`;

export const contentIntelScanner = task({
  id: "content-intel-scanner",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number; creatorId?: string }) => {
    const apiKey = (process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || "").trim();
    if (!apiKey) throw new Error("MOONSHOT_API_KEY / KIMI_API_KEY not set");

    const where: any = {
      processed: false,
      source: "mass_message",
      mediaCount: { gt: 0 },
      OR: [{ viewedCount: { gt: 0 } }, { sentCount: { gt: 10 } }],
    };
    if (payload.creatorId) where.creatorId = payload.creatorId;

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: payload.limit || 10,
      select: {
        id: true, externalId: true, creatorId: true, sentAt: true,
        textPlain: true, textHtml: true, isFree: true, mediaCount: true,
        sentCount: true, viewedCount: true, isCanceled: true,
      },
    });

    if (creatives.length === 0) {
      return { processed: 0, message: "No unprocessed creatives with media + engagement" };
    }

    // Use internal cuid as the ID sent to Kimi (avoids externalId mismatch)
    const messagesText = creatives.map((c) => {
      const vr = c.sentCount > 0 ? ((c.viewedCount / c.sentCount) * 100).toFixed(1) : "0.0";
      return `ID: ${c.id}\nCaption: ${c.textPlain || c.textHtml || "(no text)"}\nFree: ${c.isFree} | Media: ${c.mediaCount} | Sent: ${c.sentCount} | Viewed: ${c.viewedCount} | ViewRate: ${vr}%`;
    }).join("\n---\n");

    try {
      const response = await fetch(KIMI_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "kimi-k2.5",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Analyze these ${creatives.length} mass messages:\n\n${messagesText}` },
          ],
          temperature: 0.6,
          max_tokens: 1200,
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
        }),
      });

      if (!response.ok) {
        console.error(`[Content Intel] Kimi returned ${response.status} — NOT marking as processed so they retry`);
        return { processed: 0, error: `Kimi ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      let result: any = {};
      try { result = JSON.parse(content || "{}"); } catch {
        console.error(`[Content Intel] JSON parse failed — NOT marking as processed`);
        return { processed: 0, error: "JSON parse failed", rawContent: (content || "").slice(0, 200) };
      }

      // Find the results array — Kimi may use any key
      let analyzed: any[] = [];
      if (Array.isArray(result)) {
        analyzed = result;
      } else {
        const arrayVal = Object.values(result).find((v) => Array.isArray(v));
        analyzed = (arrayVal as any[]) || [];
      }

      // Build a lookup by internal ID for fast matching
      const creativeMap = new Map(creatives.map((c) => [c.id, c]));

      let insightsCreated = 0;
      for (const a of analyzed) {
        if (!a.id || !a.tacticTag) continue;
        const creative = creativeMap.get(String(a.id));
        if (!creative) continue;

        const viewRate = creative.sentCount > 0
          ? (creative.viewedCount / creative.sentCount) * 100
          : 0;

        try {
          await prisma.contentInsight.upsert({
            where: { creativeId: creative.id },
            create: {
              creativeId: creative.id,
              creatorId: creative.creatorId,
              tacticTag: a.tacticTag.toLowerCase().replace(/\s+/g, "_"),
              hookScore: Math.min(100, Math.max(0, a.hookQuality || 50)),
              insight: (a.insight || "").slice(0, 500),
              sentCount: creative.sentCount,
              viewedCount: creative.viewedCount,
              viewRate: Math.round(viewRate * 10) / 10,
            },
            update: {
              tacticTag: a.tacticTag.toLowerCase().replace(/\s+/g, "_"),
              hookScore: Math.min(100, Math.max(0, a.hookQuality || 50)),
              insight: (a.insight || "").slice(0, 500),
              sentCount: creative.sentCount,
              viewedCount: creative.viewedCount,
              viewRate: Math.round(viewRate * 10) / 10,
            },
          });
          insightsCreated++;
        } catch (e: any) {
          console.error("[Content Intel] upsert error:", e.message);
        }
      }

      await markProcessed(creatives.map((c) => c.id));

      // Log token usage
      const usage = data.usage;
      if (usage) {
        console.log(
          `[Content Intel] ${usage.prompt_tokens}in/${usage.completion_tokens}out, ${insightsCreated} insights`
        );
      }

      return {
        processed: creatives.length,
        insightsCreated,
        patterns: result.patterns || null,
      };
    } catch (e: any) {
      console.error(`[Content Intel] Error: ${e.message} — NOT marking as processed`);
      return { processed: 0, error: e.message };
    }
  },
});

async function markProcessed(ids: string[]): Promise<void> {
  await prisma.outboundCreative.updateMany({
    where: { id: { in: ids } },
    data: { processed: true },
  });
}

// Run every 30 minutes — scores 20 mass messages per batch
export const contentIntelScheduled = schedules.task({
  id: "content-intel-scheduled",
  cron: "*/30 * * * *",
  run: async () => {
    const result = await contentIntelScanner.triggerAndWait({ limit: 20 });
    return result;
  },
});

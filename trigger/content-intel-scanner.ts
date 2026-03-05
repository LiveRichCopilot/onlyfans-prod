/**
 * Content Intel Scanner — Kimi K2.5 Powered
 *
 * Scans unprocessed OutboundCreative rows with engagement.
 * Analyzes hook quality, tactic tags, what works vs doesn't.
 * Writes insights to WinningSnippet. Stateless.
 */
import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KIMI_BASE = "https://api.moonshot.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a content performance analyst for an OnlyFans agency. You analyze mass messages and evaluate what makes hooks effective.

For each message, assign:
- tacticTag: primary tactic (tease, urgency, curiosity, personal, value_frame, exclusivity, scarcity, emotional, social_proof, direct_offer)
- hookQuality: 0-100 score
- insight: one sentence on why this hook works or doesn't

Return JSON:
{
  "results": [
    { "externalId": "id", "tacticTag": "tease", "hookQuality": 75, "insight": "Strong curiosity opener but weak CTA" }
  ],
  "patterns": "2-3 sentence summary of overall patterns"
}

Be specific. "Good hook" is useless. "Opens with question creating information gap" is useful.`;

export const contentIntelScanner = task({
  id: "content-intel-scanner",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number; creatorId?: string }) => {
    const apiKey = (process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || "").trim();
    if (!apiKey) throw new Error("MOONSHOT_API_KEY / KIMI_API_KEY not set");

    const where: any = {
      processed: false,
      source: "mass_message",
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
      return { processed: 0, message: "No unprocessed creatives with engagement" };
    }

    const messagesText = creatives.map((c) => {
      const vr = c.sentCount > 0 ? ((c.viewedCount / c.sentCount) * 100).toFixed(1) : "0.0";
      return `ID: ${c.externalId}\nCaption: ${c.textPlain || c.textHtml || "(no text)"}\nFree: ${c.isFree} | Media: ${c.mediaCount} | Sent: ${c.sentCount} | Viewed: ${c.viewedCount} | ViewRate: ${vr}%`;
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
        await markProcessed(creatives.map((c) => c.id));
        return { processed: creatives.length, error: `Kimi ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      let result: any = {};
      try { result = JSON.parse(content || "{}"); } catch {
        await markProcessed(creatives.map((c) => c.id));
        return { processed: creatives.length, error: "JSON parse failed" };
      }

      // Find the results array — Kimi may use any key
      let analyzed: any[] = [];
      if (Array.isArray(result)) {
        analyzed = result;
      } else {
        const arrayVal = Object.values(result).find((v) => Array.isArray(v));
        analyzed = (arrayVal as any[]) || [];
      }

      let snippetsCreated = 0;
      for (const a of analyzed) {
        if (!a.externalId || !a.tacticTag) continue;
        const creative = creatives.find((c) => c.externalId === String(a.externalId));
        if (!creative) continue;
        try {
          await prisma.winningSnippet.create({
            data: {
              saleContextId: creative.id,
              creatorId: creative.creatorId,
              snippet: a.insight || "",
              tacticTag: a.tacticTag.toLowerCase().replace(/\s+/g, "_"),
              confidence: Math.min(1, Math.max(0, (a.hookQuality || 50) / 100)),
              saleAmount: 0,
            },
          });
          snippetsCreated++;
        } catch (e: any) {
          if (e.code !== "P2002") console.error("[Content Intel]", e.message);
        }
      }

      await markProcessed(creatives.map((c) => c.id));
      return {
        processed: creatives.length,
        snippetsCreated,
        patterns: result.patterns || null,
      };
    } catch (e: any) {
      await markProcessed(creatives.map((c) => c.id));
      return { processed: creatives.length, error: e.message };
    }
  },
});

async function markProcessed(ids: string[]): Promise<void> {
  await prisma.outboundCreative.updateMany({
    where: { id: { in: ids } },
    data: { processed: true },
  });
}

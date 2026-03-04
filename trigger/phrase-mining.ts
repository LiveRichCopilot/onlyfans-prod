/**
 * Phrase Mining Task — Kimi K2.5 Powered
 *
 * Reads unprocessed SaleContext rows, sends conversation context to Kimi K2.5,
 * extracts winning phrases and tactic tags, writes WinningSnippet rows.
 *
 * Each run is stateless — safe for parallel execution.
 */
import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KIMI_BASE = "https://api.moonshot.ai/v1/chat/completions";
const BATCH_SIZE = 10; // Process 10 SaleContexts per run

type ContextMessage = {
  text: string;
  isFromCreator: boolean;
  sentAt: string;
  price?: number;
  isTip?: boolean;
  tipAmount?: number;
};

type ExtractedSnippet = {
  snippet: string;
  tacticTag: string;
  confidence: number;
};

const SYSTEM_PROMPT = `You are a sales conversation analyst for an OnlyFans agency. You analyze chat conversations that preceded a purchase and extract the specific phrases/tactics that likely drove the sale.

Given a conversation leading to a purchase, identify the 1-5 most impactful chatter messages that contributed to the sale.

For each winning phrase, classify the tactic:
- urgency: Time pressure ("only available today", "about to delete")
- exclusivity: Making fan feel special ("just for you", "nobody else gets this")
- personalization: Using fan-specific knowledge ("since you love X")
- scarcity: Limited supply ("only 3 left", "first come first serve")
- rapport: Building connection ("I was thinking about you", "you always make me smile")
- tease: Preview/anticipation ("wait till you see what I made", "you're not ready for this")
- social_proof: Others are buying ("everyone's been asking about this")
- curiosity: Creating information gap ("I have something special", "guess what I did")
- value_frame: Reframing price ("less than a coffee", "custom just for you")
- emotional: Emotional appeal ("it would make my day", "I made this because of you")

Return JSON array:
[
  {
    "snippet": "the exact chatter message or key phrase",
    "tacticTag": "one of the tags above",
    "confidence": 0.0-1.0
  }
]

Rules:
- Only extract messages FROM THE CREATOR/CHATTER (isFromCreator=true)
- Ignore generic greetings and small talk
- If no clear winning phrase exists, return empty array []
- Confidence should reflect how directly the phrase influenced the purchase
- Higher confidence for messages close to the sale timestamp`;

export const phraseMiningTask = task({
  id: "phrase-mining",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number; saleContextId?: string }) => {
    const apiKey = (process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("MOONSHOT_API_KEY / KIMI_API_KEY not set");
    }

    const limit = payload.limit || BATCH_SIZE;

    // Fetch unprocessed SaleContexts
    const whereClause: any = { processed: false };
    if (payload.saleContextId) {
      whereClause.id = payload.saleContextId;
    }

    const contexts = await prisma.saleContext.findMany({
      where: whereClause,
      orderBy: { saleTimestamp: "desc" },
      take: limit,
    });

    if (contexts.length === 0) {
      return { processed: 0, message: "No unprocessed SaleContexts" };
    }

    let processed = 0;
    let snippetsCreated = 0;
    let errors = 0;

    for (const ctx of contexts) {
      try {
        const messages = ctx.contextMessages as ContextMessage[];

        // Skip if no messages or no chatter messages
        const chatterMessages = messages.filter((m) => m.isFromCreator);
        if (chatterMessages.length === 0) {
          await prisma.saleContext.update({
            where: { id: ctx.id },
            data: { processed: true },
          });
          processed++;
          continue;
        }

        // Build conversation for Kimi
        const conversationText = messages
          .map((m) => {
            const role = m.isFromCreator ? "CHATTER" : "FAN";
            const extras = [];
            if (m.price && m.price > 0) extras.push(`[PPV $${m.price}]`);
            if (m.isTip) extras.push(`[TIP $${m.tipAmount}]`);
            return `[${m.sentAt}] ${role}: ${m.text} ${extras.join(" ")}`;
          })
          .join("\n");

        const userPrompt = `Sale: $${ctx.saleAmount} ${ctx.saleType} at ${ctx.saleTimestamp.toISOString()}

Conversation (${ctx.windowMinutes} min before sale):
${conversationText}

Extract the winning phrases that drove this $${ctx.saleAmount} ${ctx.saleType}.`;

        // Call Kimi K2.5
        const response = await fetch(KIMI_BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "kimi-k2.5",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Phrase Mining] Kimi error for ${ctx.id}:`, response.status, errText);
          errors++;
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          errors++;
          continue;
        }

        let snippets: ExtractedSnippet[] = [];
        try {
          const parsed = JSON.parse(content);
          snippets = Array.isArray(parsed) ? parsed : parsed.snippets || parsed.phrases || [];
        } catch {
          console.error(`[Phrase Mining] JSON parse error for ${ctx.id}`);
          errors++;
          continue;
        }

        // Resolve chatter from ScheduleShift at sale time
        const chatterEmail = await resolveChatter(ctx.creatorId, ctx.saleTimestamp);

        // Write WinningSnippets
        for (const s of snippets) {
          if (!s.snippet || !s.tacticTag) continue;
          await prisma.winningSnippet.create({
            data: {
              saleContextId: ctx.id,
              creatorId: ctx.creatorId,
              chatterEmail,
              snippet: s.snippet.slice(0, 500),
              tacticTag: s.tacticTag.toLowerCase().replace(/\s+/g, "_"),
              confidence: Math.min(1, Math.max(0, s.confidence || 0.5)),
              saleAmount: ctx.saleAmount,
            },
          });
          snippetsCreated++;
        }

        // Mark as processed
        await prisma.saleContext.update({
          where: { id: ctx.id },
          data: { processed: true },
        });

        // Log token usage
        const usage = data.usage;
        if (usage) {
          console.log(
            `[Phrase Mining] ${ctx.id}: ${usage.prompt_tokens}in/${usage.completion_tokens}out, ${snippets.length} snippets`
          );
        }

        processed++;
      } catch (e: any) {
        console.error(`[Phrase Mining] Error processing ${ctx.id}:`, e.message);
        errors++;
      }
    }

    return {
      processed,
      snippetsCreated,
      errors,
      total: contexts.length,
      message: `Mined ${snippetsCreated} snippets from ${processed} contexts`,
    };
  },
});

/**
 * Resolve which chatter was on shift at sale time using ScheduleShift.
 */
async function resolveChatter(creatorId: string, saleTime: Date): Promise<string | null> {
  const dayOfWeek = saleTime.getUTCDay();

  // Determine shift type from UK hour
  const ukHour = new Date(
    saleTime.toLocaleString("en-US", { timeZone: "Europe/London" })
  ).getHours();

  let shiftType: string;
  if (ukHour >= 7 && ukHour < 15) shiftType = "morning";
  else if (ukHour >= 15 && ukHour < 23) shiftType = "afternoon";
  else shiftType = "night";

  const shift = await prisma.scheduleShift.findFirst({
    where: { creatorId, dayOfWeek, shiftType },
    select: { chatterEmail: true },
  });

  return shift?.chatterEmail || null;
}

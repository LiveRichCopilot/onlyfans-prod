/**
 * Sora "Suggested Price Points" generator.
 *
 * Reads her real 14-day price history (already ranked by $ earned)
 * and returns 3 suggestions for this week with plain-English reasons.
 * No AI, just math on what she actually did.
 *
 * Extracted to its own file so lib/sora-analysis.ts stays under 400 lines.
 */

import type { PricePointOut } from "./sora-analysis";

export type SuggestedOut = {
  priceDollars: number;
  reason: string;
  stat: string;
  lastUsedAt: string | null;
};

export function buildSuggestions(pricePoints: PricePointOut[]): SuggestedOut[] {
  const suggestions: SuggestedOut[] = [];
  const earners = pricePoints.slice();

  if (earners.length > 0) {
    const top = earners[0];
    suggestions.push({
      priceDollars: top.priceDollars,
      reason: "Your top earner in the last 14 days",
      stat: `$${top.earned.toFixed(2)} earned from ${top.massesSent} paid mass${top.massesSent === 1 ? "" : "es"}`,
      lastUsedAt: top.lastUsedAt,
    });
  }
  if (earners.length > 1) {
    const second = earners[1];
    suggestions.push({
      priceDollars: second.priceDollars,
      reason: "Variety — your second-best earner",
      stat: `$${second.earned.toFixed(2)} earned from ${second.massesSent} paid mass${second.massesSent === 1 ? "" : "es"}`,
      lastUsedAt: second.lastUsedAt,
    });
  }
  if (earners.length > 2) {
    const rest = earners
      .slice(2)
      .sort((a, b) => new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime());
    const fresh = rest[0];
    const daysAgo = Math.round((Date.now() - new Date(fresh.lastUsedAt).getTime()) / 86400000);
    suggestions.push({
      priceDollars: fresh.priceDollars,
      reason: "Bring back — earned before, haven't used it in a while",
      stat: `$${fresh.earned.toFixed(2)} earned · last sent ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
      lastUsedAt: fresh.lastUsedAt,
    });
  } else if (earners.length === 2) {
    const a = earners[0].priceDollars;
    const b = earners[1].priceDollars;
    const candidates = [Math.round((a + b) / 2), Math.min(a, b) - 1, Math.max(a, b) + 1].filter(
      (v) => v > 0 && v !== a && v !== b,
    );
    if (candidates.length > 0) {
      suggestions.push({
        priceDollars: candidates[0],
        reason: "Test — between your two earners to see what happens",
        stat: "No history at this price yet",
        lastUsedAt: null,
      });
    }
  }

  return suggestions;
}

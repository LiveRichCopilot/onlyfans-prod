/**
 * Sora price/caption/pattern analysis — pure functions, no DB access.
 *
 * Takes raw OutboundCreative rows and returns everything the Sora UI
 * needs: price points ranked by $ earned, winning captions, losing
 * captions, suggested prices for this week, and pattern observations.
 *
 * Pattern detection is extracted into lib/sora-patterns.ts to keep
 * both files under the 400-line limit.
 */

import { buildPatterns, type PatternOut } from "./sora-patterns";

export type { PatternOut };

export type RawRow = {
  id: string;
  sentAt: Date;
  textPlain: string | null;
  textHtml: string | null;
  priceCents: number | null;
  sentCount: number | null;
  purchasedCount: number | null;
  isFree: boolean;
  raw: any;
  media: Array<{
    thumbUrl: string | null;
    previewUrl: string | null;
    fullUrl: string | null;
    permanentUrl: string | null;
    mediaType: string;
  }>;
};

type EnrichedRow = {
  id: string;
  sentAt: Date;
  textPlain: string | null;
  textHtml: string | null;
  priceCents: number;
  sentCount: number | null;
  purchasedCount: number | null;
  thumbnailUrl: string | null;
};

export type PricePointOut = {
  priceDollars: number;
  massesSent: number;
  sends: number;
  purchases: number;
  earned: number;
  earnedPerSend: number;
  purchaseRate: number;
  lastUsedAt: string;
  firstUsedAt: string;
};

export type CaptionOut = {
  text: string;
  timesUsed: number;
  sends: number;
  purchases: number;
  earned: number;
  earnedPerSend: number;
  lastUsed: Date;
  lastPriceDollars: number | null;
  thumbnailUrl: string | null;
};

export type SuggestedOut = {
  priceDollars: number;
  reason: string;
  stat: string;
  lastUsedAt: string | null;
};

export type AnalysisResult = {
  paidMassCount: number;
  rowsMissingPrice: number;
  totalSends: number;
  totalPurchases: number;
  totalEarned: number;
  pricePoints: PricePointOut[];
  pricePointsNoEarnings: PricePointOut[];
  suggestedPricePoints: SuggestedOut[];
  captionsPerformedSuccessfully: CaptionOut[];
  captionsPerformedPoorly: CaptionOut[];
  patterns: PatternOut[];
};

function extractPriceCents(row: RawRow): number | null {
  if (row.priceCents != null && row.priceCents > 0) return row.priceCents;
  if (row.isFree) return null;
  const raw = row.raw;
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.price, raw.mediaPrice, raw.messagePrice, raw?.media?.[0]?.price];
  for (const c of candidates) {
    if (c == null) continue;
    const n = typeof c === "string" ? parseFloat(c) : Number(c);
    if (!isNaN(n) && n > 0) return Math.round(n * 100);
  }
  return null;
}

function pickThumb(media: RawRow["media"]): string | null {
  if (!media || media.length === 0) return null;
  const m = media[0];
  return m.permanentUrl || m.thumbUrl || m.previewUrl || m.fullUrl || null;
}

function buildPricePoints(paidRows: EnrichedRow[]): {
  pricePoints: PricePointOut[];
  pricePointsNoEarnings: PricePointOut[];
} {
  const priceMap = new Map<
    number,
    {
      priceCents: number;
      massesSent: number;
      sends: number;
      purchases: number;
      earnedCents: number;
      lastUsedAt: Date;
      firstUsedAt: Date;
    }
  >();

  for (const r of paidRows) {
    const pc = r.priceCents;
    const cur = priceMap.get(pc) || {
      priceCents: pc,
      massesSent: 0,
      sends: 0,
      purchases: 0,
      earnedCents: 0,
      lastUsedAt: r.sentAt,
      firstUsedAt: r.sentAt,
    };
    cur.massesSent += 1;
    cur.sends += r.sentCount || 0;
    cur.purchases += r.purchasedCount || 0;
    cur.earnedCents += (r.purchasedCount || 0) * pc;
    if (r.sentAt > cur.lastUsedAt) cur.lastUsedAt = r.sentAt;
    if (r.sentAt < cur.firstUsedAt) cur.firstUsedAt = r.sentAt;
    priceMap.set(pc, cur);
  }

  const all = [...priceMap.values()].map((p) => ({
    priceDollars: p.priceCents / 100,
    massesSent: p.massesSent,
    sends: p.sends,
    purchases: p.purchases,
    earned: Math.round(p.earnedCents) / 100,
    earnedPerSend: p.sends > 0 ? Math.round(p.earnedCents / p.sends) / 100 : 0,
    purchaseRate: p.sends > 0 ? p.purchases / p.sends : 0,
    lastUsedAt: p.lastUsedAt.toISOString(),
    firstUsedAt: p.firstUsedAt.toISOString(),
  }));

  return {
    pricePoints: all.filter((p) => p.earned > 0).sort((a, b) => b.earned - a.earned),
    pricePointsNoEarnings: all.filter((p) => p.earned === 0).sort((a, b) => b.sends - a.sends),
  };
}

function buildCaptions(paidRows: EnrichedRow[]): {
  captionMap: Map<
    string,
    {
      text: string;
      timesUsed: number;
      sends: number;
      purchases: number;
      earnedCents: number;
      lastUsed: Date;
      lastPriceCents: number | null;
      thumbnailUrl: string | null;
    }
  >;
  successful: CaptionOut[];
  poorly: CaptionOut[];
} {
  const captionMap = new Map<
    string,
    {
      text: string;
      timesUsed: number;
      sends: number;
      purchases: number;
      earnedCents: number;
      lastUsed: Date;
      lastPriceCents: number | null;
      thumbnailUrl: string | null;
    }
  >();

  for (const r of paidRows) {
    const rawText = (r.textPlain || r.textHtml || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!rawText) continue;
    const key = rawText.toLowerCase();
    const earnedCents = (r.purchasedCount || 0) * r.priceCents;
    const cur = captionMap.get(key) || {
      text: rawText,
      timesUsed: 0,
      sends: 0,
      purchases: 0,
      earnedCents: 0,
      lastUsed: r.sentAt,
      lastPriceCents: r.priceCents,
      thumbnailUrl: r.thumbnailUrl,
    };
    cur.timesUsed += 1;
    cur.sends += r.sentCount || 0;
    cur.purchases += r.purchasedCount || 0;
    cur.earnedCents += earnedCents;
    if (r.sentAt > cur.lastUsed) {
      cur.lastUsed = r.sentAt;
      cur.lastPriceCents = r.priceCents;
      if (r.thumbnailUrl) cur.thumbnailUrl = r.thumbnailUrl;
    }
    captionMap.set(key, cur);
  }

  const all: CaptionOut[] = [...captionMap.values()].map((c) => ({
    text: c.text,
    timesUsed: c.timesUsed,
    sends: c.sends,
    purchases: c.purchases,
    earned: Math.round(c.earnedCents) / 100,
    earnedPerSend: c.sends > 0 ? Math.round(c.earnedCents / c.sends) / 100 : 0,
    lastUsed: c.lastUsed,
    lastPriceDollars: c.lastPriceCents ? c.lastPriceCents / 100 : null,
    thumbnailUrl: c.thumbnailUrl,
  }));

  return {
    captionMap,
    successful: all
      .filter((c) => c.earned > 0)
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 5),
    poorly: all
      .filter((c) => c.earned === 0 && c.sends >= 2)
      .sort((a, b) => b.sends - a.sends)
      .slice(0, 5),
  };
}

function buildSuggestions(pricePoints: PricePointOut[]): SuggestedOut[] {
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

// Pattern detection lives in lib/sora-patterns.ts (kept small enough here).

export function analyzeRows(rows: RawRow[]): AnalysisResult {
  const paidRows: EnrichedRow[] = [];
  let rowsMissingPrice = 0;

  for (const r of rows) {
    const pc = extractPriceCents(r);
    if (pc == null) {
      if (!r.isFree) rowsMissingPrice++;
      continue;
    }
    paidRows.push({
      id: r.id,
      sentAt: r.sentAt,
      textPlain: r.textPlain,
      textHtml: r.textHtml,
      priceCents: pc,
      sentCount: r.sentCount,
      purchasedCount: r.purchasedCount,
      thumbnailUrl: pickThumb(r.media),
    });
  }

  const { pricePoints, pricePointsNoEarnings } = buildPricePoints(paidRows);
  const { captionMap, successful, poorly } = buildCaptions(paidRows);
  const suggestedPricePoints = buildSuggestions(pricePoints);
  const captionSummaries = [...captionMap.values()].map((c) => ({
    text: c.text,
    timesUsed: c.timesUsed,
  }));
  const patterns = buildPatterns({
    paidRows: paidRows.map((r) => ({
      sentAt: r.sentAt,
      priceCents: r.priceCents,
      sentCount: r.sentCount,
      purchasedCount: r.purchasedCount,
    })),
    pricePoints,
    captions: captionSummaries,
  });

  const totalSends = paidRows.reduce((s, r) => s + (r.sentCount || 0), 0);
  const totalPurchases = paidRows.reduce((s, r) => s + (r.purchasedCount || 0), 0);
  const totalEarnedCents = paidRows.reduce(
    (s, r) => s + (r.purchasedCount || 0) * r.priceCents,
    0,
  );

  return {
    paidMassCount: paidRows.length,
    rowsMissingPrice,
    totalSends,
    totalPurchases,
    totalEarned: Math.round(totalEarnedCents) / 100,
    pricePoints,
    pricePointsNoEarnings,
    suggestedPricePoints,
    captionsPerformedSuccessfully: successful,
    captionsPerformedPoorly: poorly,
    patterns,
  };
}

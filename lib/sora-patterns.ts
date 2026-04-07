/**
 * Sora pattern detection — pure functions.
 *
 * Looks for observations Sora might be missing: time-of-day windows,
 * day-of-week strength, reused captions, untried prices in her range,
 * dormant winners, price resistance thresholds.
 *
 * Kept in its own file so lib/sora-analysis.ts stays under 400 lines.
 */

import type { PricePointOut } from "./sora-analysis";

export type PatternOut = { title: string; detail: string };

type PatternRow = {
  sentAt: Date;
  priceCents: number;
  sentCount: number | null;
  purchasedCount: number | null;
};

type CaptionSummary = {
  text: string;
  timesUsed: number;
};

export function buildPatterns(args: {
  paidRows: PatternRow[];
  pricePoints: PricePointOut[];
  captions: CaptionSummary[];
}): PatternOut[] {
  const { paidRows, pricePoints, captions } = args;
  const patterns: PatternOut[] = [];

  // Time of day buckets
  if (paidRows.length >= 4) {
    const buckets = [
      { name: "Morning (5am–11am)", start: 5, end: 11, earnedCents: 0, sends: 0 },
      { name: "Midday (11am–3pm)", start: 11, end: 15, earnedCents: 0, sends: 0 },
      { name: "Afternoon (3pm–7pm)", start: 15, end: 19, earnedCents: 0, sends: 0 },
      { name: "Evening (7pm–11pm)", start: 19, end: 23, earnedCents: 0, sends: 0 },
      { name: "Late night (11pm–5am)", start: 23, end: 29, earnedCents: 0, sends: 0 },
    ];
    for (const r of paidRows) {
      const hour = new Date(r.sentAt).getHours();
      const h = hour < 5 ? hour + 24 : hour;
      const b = buckets.find((x) => h >= x.start && h < x.end);
      if (!b) continue;
      b.earnedCents += (r.purchasedCount || 0) * r.priceCents;
      b.sends += r.sentCount || 0;
    }
    const earning = buckets.filter((b) => b.earnedCents > 0);
    if (earning.length >= 2) {
      const best = [...earning].sort((a, b) => b.earnedCents - a.earnedCents)[0];
      patterns.push({
        title: "Best time of day",
        detail: `Masses sent during ${best.name} earned $${(best.earnedCents / 100).toFixed(2)} total.`,
      });
    }
    const dead = buckets.filter((b) => b.sends > 20 && b.earnedCents === 0)[0];
    if (dead) {
      patterns.push({
        title: "Dead zone",
        detail: `${dead.name} sends (${dead.sends.toLocaleString()} total) earned $0. Worth testing a different window.`,
      });
    }
  }

  // Day of week
  if (paidRows.length >= 4) {
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const days = names.map((name) => ({ name, earnedCents: 0, sends: 0 }));
    for (const r of paidRows) {
      const d = new Date(r.sentAt).getDay();
      days[d].earnedCents += (r.purchasedCount || 0) * r.priceCents;
      days[d].sends += r.sentCount || 0;
    }
    const earning = days.filter((d) => d.earnedCents > 0);
    if (earning.length >= 2) {
      const best = [...earning].sort((a, b) => b.earnedCents - a.earnedCents)[0];
      patterns.push({
        title: "Strongest day of the week",
        detail: `${best.name} brought in $${(best.earnedCents / 100).toFixed(2)} across your paid masses.`,
      });
    }
  }

  // Reused captions
  const heavy = captions.filter((c) => c.timesUsed >= 3);
  if (heavy.length > 0) {
    const top = [...heavy].sort((a, b) => b.timesUsed - a.timesUsed)[0];
    const preview = top.text.length > 60 ? top.text.slice(0, 60) + "…" : top.text;
    patterns.push({
      title: "Caption reused often",
      detail: `"${preview}" has been sent ${top.timesUsed} times — audience may be getting desensitized.`,
    });
  }

  // Untried prices in her earning range
  if (pricePoints.length >= 2) {
    const prices = pricePoints.map((p) => p.priceDollars).sort((a, b) => a - b);
    const lo = prices[0];
    const hi = prices[prices.length - 1];
    const gaps: number[] = [];
    for (let v = Math.ceil(lo) + 1; v < Math.floor(hi); v++) {
      if (!prices.includes(v)) gaps.push(v);
    }
    if (gaps.length > 0 && gaps.length <= 5) {
      patterns.push({
        title: "Untried prices in your earning range",
        detail: `You've earned at $${lo}–$${hi} but never tried $${gaps.join(", $")}. Worth a test.`,
      });
    }
  }

  // Dormant winner
  const now = Date.now();
  const dormant = [...pricePoints]
    .filter((p) => (now - new Date(p.lastUsedAt).getTime()) / 86400000 >= 7 && p.earned > 0)
    .sort((a, b) => b.earned - a.earned)[0];
  if (dormant) {
    const daysAgo = Math.round((now - new Date(dormant.lastUsedAt).getTime()) / 86400000);
    patterns.push({
      title: "Dormant winner",
      detail: `$${dormant.priceDollars} earned $${dormant.earned.toFixed(2)} but you haven't sent at that price in ${daysAgo} days.`,
    });
  }

  // Price resistance
  if (pricePoints.length >= 3) {
    const byPrice = [...pricePoints].sort((a, b) => a.priceDollars - b.priceDollars);
    for (let i = 1; i < byPrice.length; i++) {
      const prev = byPrice[i - 1];
      const curr = byPrice[i];
      if (prev.purchases === 0 || curr.purchases === 0) continue;
      const drop = 1 - curr.purchases / prev.purchases;
      if (drop >= 0.5 && curr.priceDollars - prev.priceDollars <= 10) {
        patterns.push({
          title: "Price resistance",
          detail: `Purchases drop ${Math.round(drop * 100)}% going from $${prev.priceDollars} to $${curr.priceDollars}. Consider staying at $${prev.priceDollars} for higher volume.`,
        });
        break;
      }
    }
  }

  return patterns;
}

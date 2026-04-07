import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSoraAuthSafe, canAccessModel } from "@/lib/sora-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/sora/price-points?modelId=xxx&days=14
 *
 * Returns, in Sora's words:
 *   - pricePoints: her ACTUAL distinct prices over 14 days, ranked by
 *     TOTAL MONEY EARNED (highest → lowest). Rows earning $0 are excluded
 *     from the main list.
 *   - captionsPerformedSuccessfully: captions with earned > 0, ranked by
 *     total earned.
 *   - captionsPerformedPoorly: captions that sent but earned $0.
 *
 * Access: any logged-in user who owns this model (admins see everything).
 *
 * Price resolution: reads priceCents from OutboundCreative, falling back
 * to the raw OFAPI JSON (raw.price or raw.mediaPrice) when priceCents is
 * null. Older rows were stored before we parsed the price correctly.
 */

function extractPriceCents(row: {
  priceCents: number | null;
  isFree: boolean;
  raw: any;
}): number | null {
  if (row.priceCents != null && row.priceCents > 0) return row.priceCents;
  if (row.isFree) return null;
  const raw = row.raw;
  if (!raw || typeof raw !== "object") return null;
  const candidates = [
    raw.price,
    raw.mediaPrice,
    raw.messagePrice,
    raw?.media?.[0]?.price,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const n = typeof c === "string" ? parseFloat(c) : Number(c);
    if (!isNaN(n) && n > 0) return Math.round(n * 100);
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const ctx = await getSoraAuthSafe();
    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const daysRaw = searchParams.get("days");
    const days = Math.min(60, Math.max(1, parseInt(daysRaw || "14", 10) || 14));

    if (!modelId) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    const allowed = await canAccessModel(ctx, modelId);
    if (!allowed) {
      return NextResponse.json({ error: "Not authorized for this model" }, { status: 403 });
    }

    const model = await prisma.creator.findUnique({
      where: { id: modelId },
      select: { id: true, name: true, ofUsername: true },
    });
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    const rows = await prisma.outboundCreative.findMany({
      where: {
        creatorId: modelId,
        source: "mass_message",
        sentAt: { gte: startDate, lte: endDate },
        isCanceled: false,
      },
      select: {
        id: true,
        sentAt: true,
        textPlain: true,
        textHtml: true,
        priceCents: true,
        sentCount: true,
        purchasedCount: true,
        isFree: true,
        raw: true,
        media: {
          select: {
            thumbUrl: true,
            previewUrl: true,
            fullUrl: true,
            permanentUrl: true,
            mediaType: true,
          },
          take: 1,
        },
      },
      orderBy: { sentAt: "desc" },
    });

    function pickThumb(media: any[]): string | null {
      if (!media || media.length === 0) return null;
      const m = media[0];
      return m.permanentUrl || m.thumbUrl || m.previewUrl || m.fullUrl || null;
    }

    // Resolve prices (with raw fallback) and keep paid masses only
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

    const paidRows: EnrichedRow[] = [];
    let rowsMissingPrice = 0;
    for (const r of rows as typeof rows) {
      const pc = extractPriceCents({
        priceCents: r.priceCents,
        isFree: r.isFree,
        raw: r.raw,
      });
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
        thumbnailUrl: pickThumb((r as any).media),
      });
    }

    // Group by distinct price — compute total earned, rank by $$
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
      const sends = r.sentCount || 0;
      const purchases = r.purchasedCount || 0;
      const earnedCents = purchases * pc;
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
      cur.sends += sends;
      cur.purchases += purchases;
      cur.earnedCents += earnedCents;
      if (r.sentAt > cur.lastUsedAt) cur.lastUsedAt = r.sentAt;
      if (r.sentAt < cur.firstUsedAt) cur.firstUsedAt = r.sentAt;
      priceMap.set(pc, cur);
    }

    const allPricePoints = [...priceMap.values()].map((p) => ({
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

    // Per Jay: rank by TOTAL MONEY EARNED, highest to lowest. Zero isn't money.
    const pricePoints = allPricePoints
      .filter((p) => p.earned > 0)
      .sort((a, b) => b.earned - a.earned);

    const pricePointsNoEarnings = allPricePoints
      .filter((p) => p.earned === 0)
      .sort((a, b) => b.sends - a.sends);

    // Group by caption — same ranking rule (by total earned)
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

    const captionsAll = [...captionMap.values()].map((c) => ({
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

    const captionsPerformedSuccessfully = captionsAll
      .filter((c) => c.earned > 0)
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 5);

    const captionsPerformedPoorly = captionsAll
      .filter((c) => c.earned === 0 && c.sends >= 2)
      .sort((a, b) => b.sends - a.sends)
      .slice(0, 5);

    const totalSends = paidRows.reduce(
      (s: number, r: EnrichedRow) => s + (r.sentCount || 0),
      0,
    );
    const totalPurchases = paidRows.reduce(
      (s: number, r: EnrichedRow) => s + (r.purchasedCount || 0),
      0,
    );
    const totalEarnedCents = paidRows.reduce(
      (s: number, r: EnrichedRow) => s + (r.purchasedCount || 0) * r.priceCents,
      0,
    );

    return NextResponse.json({
      model: { id: model.id, name: model.name, ofUsername: model.ofUsername },
      windowDays: days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paidMassCount: paidRows.length,
      rowsMissingPrice,
      totalSends,
      totalPurchases,
      totalEarned: Math.round(totalEarnedCents) / 100,
      pricePoints,
      pricePointsNoEarnings,
      captionsPerformedSuccessfully,
      captionsPerformedPoorly,
    });
  } catch (err: any) {
    console.error("[sora/price-points]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

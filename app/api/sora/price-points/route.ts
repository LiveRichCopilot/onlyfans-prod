import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSoraAuthSafe } from "@/lib/sora-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/sora/price-points?modelId=xxx&days=14
 *
 * Reads mass messages from OutboundCreative (auto-populated by the
 * sync-outbound-content cron every 10 min) and returns, in Sora's language:
 *   - pricePoints: her ACTUAL distinct prices, ranked by earned-per-send
 *   - captionsPerformedSuccessfully: top captions by earned-per-send
 *   - captionsPerformedPoorly: captions that sent but nobody bought
 *
 * No invented prices. No bucket ranges. Only what she actually did.
 *
 * Access: any logged-in user (the whole app is managers-only).
 */
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
      },
      orderBy: { sentAt: "desc" },
    });

    // Paid masses only — group by actual distinct price she used
    const paidRows = rows.filter(
      (r: typeof rows[number]) => !r.isFree && r.priceCents != null && r.priceCents > 0
    );

    const priceMap = new Map<
      number,
      {
        priceCents: number;
        massesSent: number;
        sends: number;
        purchases: number;
        earnedCents: number;
      }
    >();

    for (const r of paidRows) {
      const pc = r.priceCents!;
      const sends = r.sentCount || 0;
      const purchases = r.purchasedCount || 0;
      const earnedCents = purchases * pc;
      const cur = priceMap.get(pc) || {
        priceCents: pc,
        massesSent: 0,
        sends: 0,
        purchases: 0,
        earnedCents: 0,
      };
      cur.massesSent += 1;
      cur.sends += sends;
      cur.purchases += purchases;
      cur.earnedCents += earnedCents;
      priceMap.set(pc, cur);
    }

    const pricePoints = [...priceMap.values()]
      .map((p) => ({
        priceDollars: p.priceCents / 100,
        massesSent: p.massesSent,
        sends: p.sends,
        purchases: p.purchases,
        earned: Math.round(p.earnedCents) / 100,
        earnedPerSend: p.sends > 0 ? Math.round(p.earnedCents / p.sends) / 100 : 0,
        purchaseRate: p.sends > 0 ? p.purchases / p.sends : 0,
      }))
      .sort((a, b) => b.earnedPerSend - a.earnedPerSend);

    // Group by caption text — strip HTML, trim, lowercase for the hash key
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
      }
    >();

    for (const r of paidRows) {
      const rawText = (r.textPlain || r.textHtml || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!rawText) continue;
      const key = rawText.toLowerCase();
      const earnedCents = (r.purchasedCount || 0) * (r.priceCents || 0);
      const cur = captionMap.get(key) || {
        text: rawText,
        timesUsed: 0,
        sends: 0,
        purchases: 0,
        earnedCents: 0,
        lastUsed: r.sentAt,
        lastPriceCents: r.priceCents,
      };
      cur.timesUsed += 1;
      cur.sends += r.sentCount || 0;
      cur.purchases += r.purchasedCount || 0;
      cur.earnedCents += earnedCents;
      if (r.sentAt > cur.lastUsed) {
        cur.lastUsed = r.sentAt;
        cur.lastPriceCents = r.priceCents;
      }
      captionMap.set(key, cur);
    }

    const captionsAll = [...captionMap.values()]
      .filter((c) => c.sends >= 2)
      .map((c) => ({
        text: c.text,
        timesUsed: c.timesUsed,
        sends: c.sends,
        purchases: c.purchases,
        earned: Math.round(c.earnedCents) / 100,
        earnedPerSend: c.sends > 0 ? Math.round(c.earnedCents / c.sends) / 100 : 0,
        lastUsed: c.lastUsed,
        lastPriceDollars: c.lastPriceCents ? c.lastPriceCents / 100 : null,
      }));

    const captionsPerformedSuccessfully = [...captionsAll]
      .filter((c) => c.purchases > 0)
      .sort((a, b) => b.earnedPerSend - a.earnedPerSend)
      .slice(0, 3);

    const captionsPerformedPoorly = [...captionsAll]
      .filter((c) => c.purchases === 0)
      .sort((a, b) => b.sends - a.sends)
      .slice(0, 3);

    const totalSends = paidRows.reduce(
      (s: number, r: typeof paidRows[number]) => s + (r.sentCount || 0),
      0,
    );
    const totalPurchases = paidRows.reduce(
      (s: number, r: typeof paidRows[number]) => s + (r.purchasedCount || 0),
      0,
    );
    const totalEarnedCents = paidRows.reduce(
      (s: number, r: typeof paidRows[number]) => s + (r.purchasedCount || 0) * (r.priceCents || 0),
      0,
    );

    return NextResponse.json({
      model: { id: model.id, name: model.name, ofUsername: model.ofUsername },
      windowDays: days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      paidMassCount: paidRows.length,
      totalSends,
      totalPurchases,
      totalEarned: Math.round(totalEarnedCents) / 100,
      pricePoints,
      captionsPerformedSuccessfully,
      captionsPerformedPoorly,
    });
  } catch (err: any) {
    console.error("[sora/price-points]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

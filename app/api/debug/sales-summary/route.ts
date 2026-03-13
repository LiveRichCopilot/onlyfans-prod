import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/sales-summary?days=7
 * Quick count: DM sold vs mass message sold across all models.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") || "7");
  const since = new Date(Date.now() - days * 24 * 3600_000);

  // Mass messages with purchases
  const massMessages = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int as total_ppvs,
      COUNT(*) FILTER (WHERE "purchasedCount" > 0)::int as sold,
      COUNT(*) FILTER (WHERE "purchasedCount" = 0)::int as unsold,
      COUNT(*) FILTER (WHERE "purchasedCount" IS NULL)::int as unknown,
      COALESCE(SUM("purchasedCount") FILTER (WHERE "purchasedCount" > 0), 0)::int as total_purchases,
      COALESCE(SUM("priceCents" * "purchasedCount") FILTER (WHERE "purchasedCount" > 0), 0)::int as revenue_cents
    FROM "OutboundCreative"
    WHERE source = 'mass_message' AND "isFree" = false AND "priceCents" > 0 AND "sentAt" > ${since}
  ` as any[];

  // DM PPVs with purchases (transaction-based + OFAPI canPurchase)
  const dmPpvs = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int as total_ppvs,
      COUNT(*) FILTER (WHERE "purchasedCount" > 0)::int as sold_by_enrichment,
      COUNT(*) FILTER (WHERE (raw->>'canPurchase')::text = 'false')::int as sold_by_ofapi,
      COUNT(*) FILTER (WHERE "purchasedCount" = 0)::int as unsold,
      COUNT(*) FILTER (WHERE "purchasedCount" IS NULL)::int as unknown,
      COALESCE(SUM("priceCents") FILTER (WHERE "purchasedCount" > 0 OR (raw->>'canPurchase')::text = 'false'), 0)::int as revenue_cents
    FROM "OutboundCreative"
    WHERE source = 'direct_message' AND "isFree" = false AND "priceCents" > 0 AND "sentAt" > ${since}
  ` as any[];

  // Wall posts with purchases
  const wallPosts = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int as total_ppvs,
      COUNT(*) FILTER (WHERE "purchasedCount" > 0)::int as sold,
      COUNT(*) FILTER (WHERE "purchasedCount" = 0)::int as unsold,
      COUNT(*) FILTER (WHERE "purchasedCount" IS NULL)::int as unknown,
      COALESCE(SUM("purchasedCount") FILTER (WHERE "purchasedCount" > 0), 0)::int as total_purchases,
      COALESCE(SUM("priceCents" * "purchasedCount") FILTER (WHERE "purchasedCount" > 0), 0)::int as revenue_cents
    FROM "OutboundCreative"
    WHERE source = 'wall_post' AND "isFree" = false AND "priceCents" > 0 AND "sentAt" > ${since}
  ` as any[];

  // Transaction totals for comparison
  const txTotals = await prisma.$queryRaw`
    SELECT
      type,
      COUNT(*)::int as count,
      COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::numeric as revenue
    FROM "Transaction"
    WHERE date > ${since} AND amount > 0
    GROUP BY type
    ORDER BY revenue DESC
  ` as any[];

  const mm = (massMessages as any[])[0] || {};
  const dm = (dmPpvs as any[])[0] || {};
  const wp = (wallPosts as any[])[0] || {};

  return NextResponse.json({
    period: `${days} days`,
    massMessages: {
      totalPPVs: mm.total_ppvs,
      sold: mm.sold,
      unsold: mm.unsold,
      unknown: mm.unknown,
      totalPurchases: mm.total_purchases,
      revenue: `$${(mm.revenue_cents / 100).toFixed(2)}`,
    },
    dmPPVs: {
      totalPPVs: dm.total_ppvs,
      soldByEnrichment: dm.sold_by_enrichment,
      soldByOFAPI: dm.sold_by_ofapi,
      unsold: dm.unsold,
      unknown: dm.unknown,
      revenue: `$${(dm.revenue_cents / 100).toFixed(2)}`,
    },
    wallPosts: {
      totalPPVs: wp.total_ppvs,
      sold: wp.sold,
      unsold: wp.unsold,
      unknown: wp.unknown,
      totalPurchases: wp.total_purchases,
      revenue: `$${(wp.revenue_cents / 100).toFixed(2)}`,
    },
    transactionTotals: txTotals.map((t: any) => ({
      type: t.type,
      count: t.count,
      revenue: `$${Number(t.revenue).toFixed(2)}`,
    })),
  });
}

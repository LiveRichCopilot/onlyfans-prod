import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/debug/reset-dm-purchased
 * Resets purchasedCount to null on all DM PPVs so the enrichment
 * cron re-computes them with the fixed toUser.id lookup.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.outboundCreative.updateMany({
    where: {
      source: "direct_message",
      isFree: false,
      priceCents: { gt: 0 },
      purchasedCount: 0,
    },
    data: { purchasedCount: null },
  });

  return NextResponse.json({
    reset: result.count,
    message: `Reset ${result.count} DM PPVs from purchasedCount=0 to null for re-enrichment`,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/team-analytics/mass-reply-stats?creatorId=xxx&days=7
// Returns reply attribution data for mass messages
export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const where: Record<string, unknown> = { sentAt: { gte: cutoff } };
    if (creatorId) where.creatorId = creatorId;

    const replies = await prisma.massMessageReply.findMany({
      where,
      include: { creator: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    // Build a map: massMessageId -> reply stats
    const stats = replies.map((r: typeof replies[number]) => ({
      massMessageId: r.massMessageId,
      creatorId: r.creatorId,
      creatorName: r.creator.name || "Unknown",
      sentAt: r.sentAt.toISOString(),
      sentCount: r.sentCount,
      uniqueRepliers: {
        "30m": r.uniqueRepliers30m,
        "1h": r.uniqueRepliers1h,
        "6h": r.uniqueRepliers6h,
        "24h": r.uniqueRepliers24h,
      },
      inboundMessages: {
        "30m": r.inboundCount30m,
        "1h": r.inboundCount1h,
        "6h": r.inboundCount6h,
        "24h": r.inboundCount24h,
      },
      replyRate24h: r.replyRate24h,
      computedAt: r.computedAt.toISOString(),
    }));

    return NextResponse.json({ stats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ stats: [], error: msg });
  }
}

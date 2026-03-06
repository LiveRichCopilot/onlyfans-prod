import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/team-analytics/content-feed
 * Returns outbound content with media URLs for the content feed page.
 * Query: ?creatorId=xxx&days=7&mediaOnly=true
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    const days = parseInt(searchParams.get("days") || "7");
    const mediaOnly = searchParams.get("mediaOnly") === "true";

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: any = { sentAt: { gte: since } };
    if (creatorId) where.creatorId = creatorId;
    if (mediaOnly) where.mediaCount = { gt: 0 };

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 500,
      include: {
        media: { select: { mediaType: true, fullUrl: true, previewUrl: true, thumbUrl: true, permanentUrl: true } },
      },
    });

    // Get creator names for display
    const creatorIds = [...new Set(creatives.map((c) => c.creatorId))];
    const creators = await prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, ofUsername: true },
    });
    const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));

    // Summary stats
    const totalWithMedia = creatives.filter((c) => c.mediaCount > 0).length;
    const totalBumps = creatives.filter((c) => c.mediaCount === 0).length;
    const totalViews = creatives.reduce((sum, c) => sum + c.viewedCount, 0);
    const totalSent = creatives.reduce((sum, c) => sum + c.sentCount, 0);

    const items = creatives.map((c) => {
      const sentAtUk = new Date(c.sentAt).toLocaleString("en-GB", { timeZone: "Europe/London" });
      const sentDate = new Date(c.sentAt).toLocaleDateString("en-US", { timeZone: "Europe/London", month: "short", day: "numeric", year: "numeric" });
      const viewRate = c.sentCount > 0 ? ((c.viewedCount / c.sentCount) * 100).toFixed(1) : "0.0";
      const revenue = c.priceCents && c.purchasedCount ? ((c.priceCents / 100) * c.purchasedCount) : 0;
      return {
        id: c.id,
        externalId: c.externalId,
        creatorId: c.creatorId,
        creator: creatorMap[c.creatorId] || { name: "Unknown", ofUsername: "" },
        sentAt: c.sentAt,
        sentAtUk,
        sentDate,
        caption: c.textPlain || c.textHtml || "",
        isFree: c.isFree,
        priceCents: c.priceCents ?? 0,
        purchasedCount: c.purchasedCount ?? 0,
        revenue,
        mediaCount: c.mediaCount,
        sentCount: c.sentCount,
        viewedCount: c.viewedCount,
        viewRate: parseFloat(viewRate),
        isCanceled: c.isCanceled,
        type: c.mediaCount > 0 ? "content" : "bump",
        media: c.media,
        wakeUp: c.wakeUpComputed ? {
          totalReplied: c.dormantBefore ?? 0,
          buckets: (c as any).wakeUpBuckets ?? null,
          chatterDMs: (c as any).chatterDMs ?? null,
        } : null,
      };
    });

    return NextResponse.json({
      items,
      creators: creators.map((c) => ({ id: c.id, name: c.name || c.ofUsername || "Unknown" })),
      summary: {
        total: creatives.length,
        withMedia: totalWithMedia,
        bumps: totalBumps,
        totalViews,
        totalSent,
        avgViewRate: totalSent > 0 ? ((totalViews / totalSent) * 100).toFixed(2) : "0",
      },
    });
  } catch (err: any) {
    console.error("[content-feed]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

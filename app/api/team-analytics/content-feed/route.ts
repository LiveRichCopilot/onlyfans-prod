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
      take: 100,
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
      const viewRate = c.sentCount > 0 ? ((c.viewedCount / c.sentCount) * 100).toFixed(1) : "0.0";
      return {
        id: c.id,
        externalId: c.externalId,
        creator: creatorMap[c.creatorId] || { name: "Unknown" },
        sentAt: c.sentAt,
        sentAtUk,
        caption: c.textPlain || c.textHtml || "",
        isFree: c.isFree,
        mediaCount: c.mediaCount,
        sentCount: c.sentCount,
        viewedCount: c.viewedCount,
        viewRate: parseFloat(viewRate),
        isCanceled: c.isCanceled,
        type: c.mediaCount > 0 ? "content" : "bump",
        media: c.media,
        // Wake-up rate data
        wakeUp: c.wakeUpComputed ? {
          dormantBefore: c.dormantBefore ?? 0,
          w1h: c.wakeUp1h ?? 0,
          w3h: c.wakeUp3h ?? 0,
          w6h: c.wakeUp6h ?? 0,
          w24h: c.wakeUp24h ?? 0,
        } : null,
      };
    });

    return NextResponse.json({
      items,
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

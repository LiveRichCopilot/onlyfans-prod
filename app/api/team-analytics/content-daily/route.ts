import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/team-analytics/content-daily?creatorId=xxx&days=7
 * Per-creator per-day content breakdown with insights.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    const days = parseInt(searchParams.get("days") || "7");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Content Daily = mass messages + wall posts (the summary view)
    // Content Feed handles DMs + everything else
    const where: any = { sentAt: { gte: since }, source: { in: ["mass_message", "wall_post"] } };
    if (creatorId) where.creatorId = creatorId;

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      include: {
        media: { select: { mediaType: true, fullUrl: true, previewUrl: true, thumbUrl: true, permanentUrl: true } },
        insight: { select: { tacticTag: true, hookScore: true, insight: true, viewRate: true } },
      },
    });

    const creatorIds = [...new Set(creatives.map((c) => c.creatorId))];
    const creators = await prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, ofUsername: true },
    });
    const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));

    // Group by date (UK timezone)
    const dailyMap = new Map<string, {
      date: string; massMessages: number; withMedia: number; bumps: number;
      totalSent: number; totalViewed: number; free: number; paid: number;
    }>();

    for (const c of creatives) {
      const dateKey = new Date(c.sentAt).toLocaleDateString("en-GB", {
        timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
      });
      const iso = dateKey.split("/").reverse().join("-");
      const d = dailyMap.get(iso) || {
        date: iso, massMessages: 0, withMedia: 0, bumps: 0,
        totalSent: 0, totalViewed: 0, free: 0, paid: 0,
      };
      d.massMessages++;
      if (c.mediaCount > 0) d.withMedia++; else d.bumps++;
      d.totalSent += c.sentCount;
      d.totalViewed += c.viewedCount;
      if (c.isFree) d.free++; else d.paid++;
      dailyMap.set(iso, d);
    }

    const daily = [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date));

    const items = creatives.map((c) => {
      const sentAtUk = new Date(c.sentAt).toLocaleString("en-GB", { timeZone: "Europe/London" });
      const viewRate = c.sentCount > 0 ? Math.round((c.viewedCount / c.sentCount) * 1000) / 10 : 0;
      const hoursLive = Math.round((Date.now() - new Date(c.sentAt).getTime()) / 3600000);
      const isPaid = !c.isFree && c.priceCents && c.priceCents > 0;
      let status: "selling" | "stagnant" | "awaiting" | "free" | "unsent" = "free";
      if (c.isCanceled) status = "unsent";
      else if (isPaid && c.purchasedCount != null && c.purchasedCount > 0) status = "selling";
      else if (isPaid && c.purchasedCount != null && c.purchasedCount === 0 && hoursLive >= 6) status = "stagnant";
      else if (isPaid && c.purchasedCount == null) status = "awaiting"; // no buyer data yet
      else if (isPaid) status = "awaiting"; // paid, < 6h, give it time
      return {
        id: c.id, externalId: c.externalId,
        creator: creatorMap[c.creatorId] || { name: "Unknown", ofUsername: "" },
        sentAt: c.sentAt, sentAtUk, hoursLive,
        caption: c.textPlain || c.textHtml || "",
        isFree: c.isFree, priceCents: c.priceCents, mediaCount: c.mediaCount,
        sentCount: c.sentCount, viewedCount: c.viewedCount, viewRate,
        purchasedCount: c.purchasedCount,
        dormantBefore: c.dormantBefore,
        wakeUp1h: c.wakeUp1h,
        wakeUp3h: c.wakeUp3h,
        wakeUp6h: c.wakeUp6h,
        wakeUp24h: c.wakeUp24h,
        isCanceled: c.isCanceled, status,
        source: c.source, // "mass_message" | "wall_post"
        type: (c.mediaCount > 0 ? "content" : "bump") as "content" | "bump",
        media: c.media, insight: c.insight,
      };
    });

    const totalMessages = creatives.length;
    const totalWithMedia = creatives.filter((c) => c.mediaCount > 0).length;
    const totalSent = creatives.reduce((s, c) => s + c.sentCount, 0);
    const totalViewed = creatives.reduce((s, c) => s + c.viewedCount, 0);
    const avgViewRate = totalSent > 0 ? Math.round((totalViewed / totalSent) * 1000) / 10 : 0;
    const insightsCount = creatives.filter((c) => c.insight).length;

    const tacticCounts = new Map<string, { count: number; totalScore: number }>();
    for (const c of creatives) {
      if (!c.insight) continue;
      const tag = c.insight.tacticTag;
      const e = tacticCounts.get(tag) || { count: 0, totalScore: 0 };
      e.count++;
      e.totalScore += c.insight.hookScore;
      tacticCounts.set(tag, e);
    }
    const tactics = [...tacticCounts.entries()]
      .map(([tag, d]) => ({ tag, count: d.count, avgScore: Math.round(d.totalScore / d.count) }))
      .sort((a, b) => b.count - a.count);

    // Silent models — active creators with no content in this window
    const allCreators = await prisma.creator.findMany({
      where: { active: true },
      select: { id: true, name: true, ofUsername: true },
    });
    const activeCreatorIds = new Set(creatives.map((c) => c.creatorId));
    // For silent models, get their last mass message date
    const silentCreators = allCreators.filter((c) => !activeCreatorIds.has(c.id));
    const silentModels = await Promise.all(
      silentCreators.map(async (c) => {
        const last = await prisma.outboundCreative.findFirst({
          where: { creatorId: c.id, mediaCount: { gt: 0 } },
          orderBy: { sentAt: "desc" },
          select: { sentAt: true },
        });
        return {
          id: c.id, name: c.name || c.ofUsername || "Unknown",
          ofUsername: c.ofUsername,
          lastContentAt: last?.sentAt || null,
          daysSilent: last ? Math.round((Date.now() - new Date(last.sentAt).getTime()) / 86400000) : null,
        };
      })
    );

    // Model leaderboard — who sent the most
    const modelCounts = new Map<string, { name: string; ofUsername: string; massMessages: number; withMedia: number; bumps: number; totalSent: number; totalViewed: number; purchased: number }>();
    for (const c of creatives) {
      const key = c.creatorId;
      const cr = creatorMap[key] || { name: "Unknown", ofUsername: "" };
      const e = modelCounts.get(key) || { name: cr.name || "Unknown", ofUsername: cr.ofUsername || "", massMessages: 0, withMedia: 0, bumps: 0, totalSent: 0, totalViewed: 0, purchased: 0 };
      e.massMessages++;
      if (c.mediaCount > 0) e.withMedia++; else e.bumps++;
      e.totalSent += c.sentCount;
      e.totalViewed += c.viewedCount;
      if (c.purchasedCount && c.purchasedCount > 0) e.purchased += c.purchasedCount;
      modelCounts.set(key, e);
    }
    const leaderboard = [...modelCounts.values()].sort((a, b) => b.massMessages - a.massMessages);

    return NextResponse.json({
      kpis: { totalMessages, totalWithMedia, totalSent, totalViewed, avgViewRate, insightsCount },
      daily, items, tactics, silentModels, leaderboard,
      dateRange: { days, since: since.toISOString() },
    });
  } catch (err: any) {
    console.error("[content-daily]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDirectMessageStats, getMassMessageStats, getTopMessage } from "@/lib/ofapi-engagement";
import { classifyHook, getContentType, extractThumb, extractMediaType, HookCategory, MediaType } from "@/lib/content-analyzer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MediaThumb = { url: string; type: string };

type ClassifiedMessage = {
  id: string;
  rawText: string;
  hookCategory: HookCategory;
  hookText: string;
  contentType: string;
  mediaType: MediaType;
  hasMedia: boolean;
  hasCTA: boolean;
  isPPV: boolean;
  isFreePreview: boolean;
  priceBucket: string;
  textLength: string;
  viewedCount: number;
  purchasedCount: number;
  sentCount: number;
  price: number;
  date: string;
  creatorId: string;
  creatorName: string;
  source: "direct" | "mass";
  thumbnails: MediaThumb[];
  likelySender?: string;
  likelySenderEmail?: string;
};

type AggregatedEntry = {
  name: string;
  count: number;
  sentCount: number;
  viewedCount: number;
  purchasedCount: number;
  conversionRate: number;
  viewRate: number;
  purchaseRate: number;
  totalRevenue: number;
  avgPrice: number;
  rpm: number;
  ctaRate: number;
};

function aggregateByField(messages: ClassifiedMessage[], field: keyof ClassifiedMessage): AggregatedEntry[] {
  const map = new Map<string, {
    count: number; sent: number; viewed: number; purchased: number;
    revenue: number; priceSum: number; pricedCount: number; ctaCount: number;
  }>();

  for (const m of messages) {
    const key = String(m[field]) || "unknown";
    if (!map.has(key))
      map.set(key, { count: 0, sent: 0, viewed: 0, purchased: 0, revenue: 0, priceSum: 0, pricedCount: 0, ctaCount: 0 });
    const e = map.get(key)!;
    e.count++;
    e.sent += m.sentCount || 0;
    e.viewed += m.viewedCount || 0;
    e.purchased += m.purchasedCount || 0;
    e.revenue += (m.purchasedCount || 0) * (m.price || 0);
    if (m.hasCTA) e.ctaCount++;
    if (m.price > 0) {
      e.priceSum += m.price;
      e.pricedCount++;
    }
  }

  return [...map.entries()].map(([name, e]) => ({
    name,
    count: e.count,
    sentCount: e.sent,
    viewedCount: e.viewed,
    purchasedCount: e.purchased,
    conversionRate: e.viewed > 0 ? Math.round((e.purchased / e.viewed) * 10000) / 100 : 0,
    viewRate: e.sent > 0 ? Math.round((e.viewed / e.sent) * 10000) / 100 : 0,
    purchaseRate: e.sent > 0 ? Math.round((e.purchased / e.sent) * 10000) / 100 : 0,
    totalRevenue: Math.round(e.revenue * 100) / 100,
    avgPrice: e.pricedCount > 0 ? Math.round((e.priceSum / e.pricedCount) * 100) / 100 : 0,
    rpm: e.sent > 0 ? Math.round((e.revenue / e.sent) * 1000 * 100) / 100 : 0,
    ctaRate: e.count > 0 ? Math.round((e.ctaCount / e.count) * 100) : 0,
  }));
}

/** Fetch engagement data for one creator. Returns partial results on timeout. */
async function fetchCreatorEngagement(
  creator: { id: string; name: string | null; ofapiCreatorId: string; ofapiToken: string },
  startDate: Date, endDate: Date,
): Promise<{ direct: Record<string, unknown>[]; mass: Record<string, unknown>[]; top: Record<string, unknown> | null }> {
  const result: { direct: Record<string, unknown>[]; mass: Record<string, unknown>[]; top: Record<string, unknown> | null } = {
    direct: [], mass: [], top: null,
  };

  const [directRes, massRes, topRes] = await Promise.all([
    getDirectMessageStats(creator.ofapiCreatorId, creator.ofapiToken, startDate, endDate, 50, 0).catch(() => null),
    getMassMessageStats(creator.ofapiCreatorId, creator.ofapiToken, startDate, endDate, 50, 0).catch(() => null),
    getTopMessage(creator.ofapiCreatorId, creator.ofapiToken).catch(() => null),
  ]);

  const directItems = (directRes as any)?.data?.items || (directRes as any)?.items || (directRes as any)?.data?.list || [];
  for (const item of directItems) {
    result.direct.push({ ...item, creatorId: creator.id, creatorName: creator.name });
  }

  const massItems = (massRes as any)?.data?.items || (massRes as any)?.items || (massRes as any)?.data?.list || [];
  for (const item of massItems) {
    result.mass.push({ ...item, creatorId: creator.id, creatorName: creator.name });
  }

  if (topRes) {
    const top = (topRes as any)?.data || topRes;
    result.top = { ...top, creatorId: creator.id, creatorName: creator.name };
  }

  return result;
}

/** Extract thumbnails from OFAPI media array */
function extractThumbnails(mediaArr: unknown): MediaThumb[] {
  if (!Array.isArray(mediaArr)) return [];
  return mediaArr.slice(0, 4).map((med: Record<string, unknown>) => ({
    url: extractThumb(med),
    type: extractMediaType(med),
  })).filter(t => t.url);
}

/** Classify a raw OFAPI message into our format */
function classifyMessage(
  m: Record<string, any>, source: "direct" | "mass"
): ClassifiedMessage {
  const text = m.rawText || m.text || "";
  const mediaArr = m.media || [];
  const mediaCount = m.mediaCount || mediaArr.length || 0;
  const price = m.price || 0;
  const isFree = m.isFree !== false;
  const mediaTypes = Array.isArray(mediaArr) ? mediaArr.map((med: any) => extractMediaType(med)) : [];

  const features = classifyHook(text, mediaCount, price, isFree, mediaTypes);
  const thumbnails = extractThumbnails(mediaArr);

  return {
    id: String(m.id || m.messageId || Math.random()),
    rawText: text,
    hookCategory: features.hookCategory,
    hookText: features.hookText,
    contentType: getContentType(mediaCount, price, isFree, features.mediaType),
    mediaType: features.mediaType,
    hasMedia: features.hasMedia,
    hasCTA: features.hasCTA,
    isPPV: features.isPPV,
    isFreePreview: isFree && mediaCount > 0,
    priceBucket: features.priceBucket,
    textLength: features.textLength,
    viewedCount: m.viewedCount || 0,
    purchasedCount: m.purchasedCount || 0,
    sentCount: m.sentCount || 0,
    price,
    date: m.date || m.createdAt || "",
    creatorId: String(m.creatorId),
    creatorName: String(m.creatorName || "Unknown"),
    source,
    thumbnails,
  };
}

// GET /api/team-analytics/content-performance?days=7&creatorId=xxx
// OR: ?startDate=2026-02-19T00:00:00Z&endDate=2026-02-26T23:59:59Z&creatorId=xxx
export async function GET(req: NextRequest) {
  const requestStart = Date.now();
  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;

  const startParam = req.nextUrl.searchParams.get("startDate");
  const endParam = req.nextUrl.searchParams.get("endDate");
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);

  let startDate: Date;
  let endDate: Date;
  let days: number;

  if (startParam && endParam) {
    startDate = new Date(startParam);
    endDate = new Date(endParam);
    days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
  } else {
    days = daysParam;
    endDate = new Date();
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  try {
    const creatorWhere: Record<string, unknown> = { active: true, ofapiToken: { not: null } };
    if (creatorId) creatorWhere.id = creatorId;

    const creators = await prisma.creator.findMany({
      where: creatorWhere,
      select: { id: true, name: true, ofapiCreatorId: true, ofapiToken: true },
    });

    const validCreators = creators.filter(c => c.ofapiToken && c.ofapiCreatorId) as {
      id: string; name: string | null; ofapiCreatorId: string; ofapiToken: string;
    }[];

    if (validCreators.length === 0) {
      return NextResponse.json({ error: "No creators with OFAPI access" }, { status: 404 });
    }

    const allDirectMessages: Record<string, unknown>[] = [];
    const allMassMessages: Record<string, unknown>[] = [];
    const topMessages: Record<string, unknown>[] = [];
    const batchSize = 5;

    for (let i = 0; i < validCreators.length; i += batchSize) {
      if (Date.now() - requestStart > 40000) {
        console.log(`[content-perf] Time guard hit at ${i}/${validCreators.length} creators`);
        break;
      }

      const batch = validCreators.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(c => fetchCreatorEngagement(c, startDate, endDate).catch(() => ({
          direct: [] as Record<string, unknown>[],
          mass: [] as Record<string, unknown>[],
          top: null,
        })))
      );

      for (const r of results) {
        allDirectMessages.push(...r.direct);
        allMassMessages.push(...r.mass);
        if (r.top) topMessages.push(r.top);
      }
    }

    // Classify all messages
    const directClassified = allDirectMessages.map(msg => classifyMessage(msg as Record<string, any>, "direct"));
    const massClassified = allMassMessages.map(msg => classifyMessage(msg as Record<string, any>, "mass"));
    const allClassified = [...directClassified, ...massClassified];

    // --- Approximate sender attribution ---
    // Query chatter sessions overlapping the date range
    const shiftSessions = await prisma.chatterSession.findMany({
      where: {
        clockIn: { lte: endDate },
        OR: [{ clockOut: { gte: startDate } }, { clockOut: null, isLive: true }],
        ...(creatorId ? { creatorId } : {}),
      },
      select: { email: true, creatorId: true, clockIn: true, clockOut: true },
    });

    // For each message, find who was on shift when it was sent
    for (const msg of allClassified) {
      if (!msg.date) continue;
      const msgTime = new Date(msg.date).getTime();
      const match = shiftSessions.find(s =>
        s.creatorId === msg.creatorId &&
        new Date(s.clockIn).getTime() <= msgTime &&
        (s.clockOut ? new Date(s.clockOut).getTime() >= msgTime : true)
      );
      if (match) {
        (msg as any).likelySender = match.email.split("@")[0];
        (msg as any).likelySenderEmail = match.email;
      }
    }

    // Aggregations
    const hookPerformance = aggregateByField(allClassified, "hookCategory");
    const contentTypePerformance = aggregateByField(allClassified, "contentType");
    const priceBucketPerformance = aggregateByField(allClassified, "priceBucket");
    const creatorPerformance = aggregateByField(allClassified, "creatorName");

    // Top performing — sorted by revenue
    const topDirect = [...directClassified]
      .filter(m => m.purchasedCount > 0)
      .sort((a, b) => (b.purchasedCount * b.price) - (a.purchasedCount * a.price))
      .slice(0, 25);

    const topMass = [...massClassified]
      .filter(m => m.purchasedCount > 0 || m.viewedCount > 0)
      .sort((a, b) => (b.purchasedCount * b.price) - (a.purchasedCount * a.price))
      .slice(0, 25);

    // "No bites" — messages with views but zero purchases
    const noBitesDirect = [...directClassified]
      .filter(m => m.viewedCount > 0 && m.purchasedCount === 0 && m.price > 0)
      .sort((a, b) => b.viewedCount - a.viewedCount)
      .slice(0, 20);

    const noBitesMass = [...massClassified]
      .filter(m => (m.viewedCount > 0 || m.sentCount > 0) && m.purchasedCount === 0 && m.price > 0)
      .sort((a, b) => b.viewedCount - a.viewedCount)
      .slice(0, 20);

    // KPIs
    const totalDirect = directClassified.length;
    const totalMass = massClassified.length;
    const totalMessages = allClassified.length;
    const totalSent = allClassified.reduce((s, m) => s + (m.sentCount || 0), 0);
    const totalViewed = allClassified.reduce((s, m) => s + m.viewedCount, 0);
    const totalPurchased = allClassified.reduce((s, m) => s + m.purchasedCount, 0);
    const totalRevenue = allClassified.reduce((s, m) => s + m.purchasedCount * m.price, 0);
    const avgConversionRate = totalViewed > 0 ? Math.round((totalPurchased / totalViewed) * 10000) / 100 : 0;
    const ctaCount = allClassified.filter(m => m.hasCTA).length;
    const sorted = [...hookPerformance].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const bestHook = sorted[0]?.name || "N/A";

    const elapsed = Date.now() - requestStart;
    console.log(`[content-perf] Done in ${elapsed}ms — ${validCreators.length} creators, ${allClassified.length} messages`);

    return NextResponse.json({
      dateRange: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        days,
      },
      kpis: {
        totalMessages, totalDirect, totalMass, totalSent,
        totalViewed, totalPurchased,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgConversionRate, bestHook, ctaCount,
        ctaRate: totalMessages > 0 ? Math.round((ctaCount / totalMessages) * 100) : 0,
        rpm: totalSent > 0 ? Math.round((totalRevenue / totalSent) * 1000 * 100) / 100 : 0,
      },
      hookPerformance: sorted,
      contentTypePerformance: contentTypePerformance.sort((a, b) => b.totalRevenue - a.totalRevenue),
      priceBucketPerformance: priceBucketPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue),
      creatorPerformance: creatorPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue),
      topDirect,
      topMass,
      noBitesDirect,
      noBitesMass,
      allDirect: directClassified.sort((a, b) => (b.purchasedCount * b.price) - (a.purchasedCount * a.price)),
      allMass: massClassified.sort((a, b) => (b.purchasedCount * b.price) - (a.purchasedCount * a.price)),
      topMessages: topMessages.slice(0, 5),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[content-perf] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

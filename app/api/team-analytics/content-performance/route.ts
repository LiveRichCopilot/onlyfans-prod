import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDirectMessageStats, getMassMessageStats, getTopMessage } from "@/lib/ofapi-engagement";
import { classifyHook, getContentType, HookCategory } from "@/lib/content-analyzer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ClassifiedMessage = {
  id: string;
  rawText: string;
  hookCategory: HookCategory;
  hookText: string;
  contentType: string;
  hasMedia: boolean;
  isPPV: boolean;
  priceBucket: string;
  textLength: string;
  viewedCount: number;
  purchasedCount: number;
  price: number;
  date: string;
  creatorId: string;
  creatorName: string;
  source: "direct" | "mass";
  sentCount?: number;
};

type AggregatedEntry = {
  name: string;
  count: number;
  viewedCount: number;
  purchasedCount: number;
  conversionRate: number;
  totalRevenue: number;
  avgPrice: number;
};

function aggregateByField(messages: ClassifiedMessage[], field: keyof ClassifiedMessage): AggregatedEntry[] {
  const map = new Map<
    string,
    { count: number; viewed: number; purchased: number; revenue: number; priceSum: number; pricedCount: number }
  >();

  for (const m of messages) {
    const key = String(m[field]) || "unknown";
    if (!map.has(key))
      map.set(key, { count: 0, viewed: 0, purchased: 0, revenue: 0, priceSum: 0, pricedCount: 0 });
    const e = map.get(key)!;
    e.count++;
    e.viewed += m.viewedCount || 0;
    e.purchased += m.purchasedCount || 0;
    e.revenue += (m.purchasedCount || 0) * (m.price || 0);
    if (m.price > 0) {
      e.priceSum += m.price;
      e.pricedCount++;
    }
  }

  return [...map.entries()].map(([name, e]) => ({
    name,
    count: e.count,
    viewedCount: e.viewed,
    purchasedCount: e.purchased,
    conversionRate: e.viewed > 0 ? Math.round((e.purchased / e.viewed) * 100) : 0,
    totalRevenue: Math.round(e.revenue * 100) / 100,
    avgPrice: e.pricedCount > 0 ? Math.round((e.priceSum / e.pricedCount) * 100) / 100 : 0,
  }));
}

/** Fetch engagement data for one creator (direct + mass + top). Returns partial results on timeout. */
async function fetchCreatorEngagement(
  creator: { id: string; name: string | null; ofapiCreatorId: string; ofapiToken: string },
  startDate: Date,
  endDate: Date,
): Promise<{ direct: Record<string, unknown>[]; mass: Record<string, unknown>[]; top: Record<string, unknown> | null }> {
  const result: { direct: Record<string, unknown>[]; mass: Record<string, unknown>[]; top: Record<string, unknown> | null } = {
    direct: [], mass: [], top: null,
  };

  // Run all 3 calls in parallel for this creator
  const [directRes, massRes, topRes] = await Promise.all([
    getDirectMessageStats(creator.ofapiCreatorId, creator.ofapiToken, startDate, endDate, 50, 0).catch(() => null),
    getMassMessageStats(creator.ofapiCreatorId, creator.ofapiToken, startDate, endDate, 50, 0).catch(() => null),
    getTopMessage(creator.ofapiCreatorId, creator.ofapiToken).catch(() => null),
  ]);

  // Direct messages
  const directItems = (directRes as any)?.data?.items || (directRes as any)?.items || (directRes as any)?.data?.list || [];
  for (const item of directItems) {
    result.direct.push({ ...item, creatorId: creator.id, creatorName: creator.name });
  }

  // Mass messages
  const massItems = (massRes as any)?.data?.items || (massRes as any)?.items || (massRes as any)?.data?.list || [];
  for (const item of massItems) {
    result.mass.push({ ...item, creatorId: creator.id, creatorName: creator.name });
  }

  // Top message
  if (topRes) {
    const top = (topRes as any)?.data || topRes;
    result.top = { ...top, creatorId: creator.id, creatorName: creator.name };
  }

  return result;
}

// GET /api/team-analytics/content-performance?days=7&creatorId=xxx
export async function GET(req: NextRequest) {
  const requestStart = Date.now();
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;

  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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

    // Fetch all creators in parallel (batches of 5 to avoid overwhelming OFAPI)
    const allDirectMessages: Record<string, unknown>[] = [];
    const allMassMessages: Record<string, unknown>[] = [];
    const topMessages: Record<string, unknown>[] = [];
    const batchSize = 5;

    for (let i = 0; i < validCreators.length; i += batchSize) {
      // Time guard: return what we have if nearing timeout
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

    // --- CLASSIFY HOOKS ---
    const classified: ClassifiedMessage[] = [];

    for (const msg of allDirectMessages) {
      const m = msg as Record<string, any>;
      const text = m.rawText || m.text || "";
      const mediaCount = m.mediaCount || 0;
      const price = m.price || 0;
      const isFree = m.isFree !== false;

      const features = classifyHook(text, mediaCount, price, isFree);
      classified.push({
        id: String(m.id || m.messageId || Math.random()),
        rawText: text,
        hookCategory: features.hookCategory,
        hookText: features.hookText,
        contentType: getContentType(mediaCount, price, isFree),
        hasMedia: features.hasMedia,
        isPPV: features.isPPV,
        priceBucket: features.priceBucket,
        textLength: features.textLength,
        viewedCount: m.viewedCount || 0,
        purchasedCount: m.purchasedCount || 0,
        price,
        date: m.date || m.createdAt || "",
        creatorId: String(m.creatorId),
        creatorName: String(m.creatorName || "Unknown"),
        source: "direct",
      });
    }

    for (const msg of allMassMessages) {
      const m = msg as Record<string, any>;
      const text = m.rawText || m.text || "";
      const mediaCount = m.mediaCount || 0;
      const price = m.price || 0;
      const isFree = m.isFree !== false;

      const features = classifyHook(text, mediaCount, price, isFree);
      classified.push({
        id: String(m.id || m.messageId || Math.random()),
        rawText: text,
        hookCategory: features.hookCategory,
        hookText: features.hookText,
        contentType: getContentType(mediaCount, price, isFree),
        hasMedia: features.hasMedia,
        isPPV: features.isPPV,
        priceBucket: features.priceBucket,
        textLength: features.textLength,
        viewedCount: m.viewedCount || 0,
        purchasedCount: m.purchasedCount || 0,
        price,
        date: m.date || m.createdAt || "",
        creatorId: String(m.creatorId),
        creatorName: String(m.creatorName || "Unknown"),
        source: "mass",
        sentCount: m.sentCount || 0,
      });
    }

    // --- AGGREGATIONS ---
    const hookPerformance = aggregateByField(classified, "hookCategory");
    const contentTypePerformance = aggregateByField(classified, "contentType");
    const priceBucketPerformance = aggregateByField(classified, "priceBucket");
    const creatorPerformance = aggregateByField(classified, "creatorName");

    const topPerformingDirect = [...classified]
      .filter((m) => m.source === "direct" && m.purchasedCount > 0)
      .sort((a, b) => b.purchasedCount - a.purchasedCount)
      .slice(0, 10)
      .map((m) => ({
        hookText: m.hookText, hookCategory: m.hookCategory, contentType: m.contentType,
        price: m.price, purchasedCount: m.purchasedCount, viewedCount: m.viewedCount,
        conversionRate: m.viewedCount > 0 ? Math.round((m.purchasedCount / m.viewedCount) * 100) : 0,
        revenue: m.purchasedCount * m.price, creatorName: m.creatorName, date: m.date,
      }));

    const topPerformingMass = [...classified]
      .filter((m) => m.source === "mass" && (m.purchasedCount > 0 || m.viewedCount > 0))
      .sort((a, b) => b.purchasedCount - a.purchasedCount)
      .slice(0, 10)
      .map((m) => ({
        hookText: m.hookText, hookCategory: m.hookCategory, contentType: m.contentType,
        price: m.price, sentCount: m.sentCount || 0, viewedCount: m.viewedCount,
        purchasedCount: m.purchasedCount,
        openRate: m.sentCount && m.sentCount > 0 ? Math.round((m.viewedCount / m.sentCount) * 100) : 0,
        conversionRate: m.viewedCount > 0 ? Math.round((m.purchasedCount / m.viewedCount) * 100) : 0,
        revenue: m.purchasedCount * m.price, creatorName: m.creatorName, date: m.date,
      }));

    // --- KPIs ---
    const totalMessages = classified.length;
    const totalDirect = classified.filter((m) => m.source === "direct").length;
    const totalMass = classified.filter((m) => m.source === "mass").length;
    const totalViewed = classified.reduce((s, m) => s + m.viewedCount, 0);
    const totalPurchased = classified.reduce((s, m) => s + m.purchasedCount, 0);
    const totalRevenue = classified.reduce((s, m) => s + m.purchasedCount * m.price, 0);
    const avgConversionRate = totalViewed > 0 ? Math.round((totalPurchased / totalViewed) * 100) : 0;
    const sorted = [...hookPerformance].sort((a, b) => b.conversionRate - a.conversionRate);
    const bestHook = sorted[0]?.name || "N/A";

    const elapsed = Date.now() - requestStart;
    console.log(`[content-perf] Done in ${elapsed}ms — ${validCreators.length} creators, ${classified.length} messages`);

    return NextResponse.json({
      kpis: { totalMessages, totalDirect, totalMass, totalViewed, totalPurchased, totalRevenue: Math.round(totalRevenue * 100) / 100, avgConversionRate, bestHook },
      hookPerformance: sorted,
      contentTypePerformance: contentTypePerformance.sort((a, b) => b.conversionRate - a.conversionRate),
      priceBucketPerformance: priceBucketPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue),
      creatorPerformance: creatorPerformance.sort((a, b) => b.totalRevenue - a.totalRevenue),
      topPerformingDirect,
      topPerformingMass,
      topMessages: topMessages.slice(0, 5),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[content-perf] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

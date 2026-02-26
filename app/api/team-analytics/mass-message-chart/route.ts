import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMassMessageChartData } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type DailyPoint = { date: string; sent: number; purchased: number; revenue: number };

// GET /api/team-analytics/mass-message-chart?days=7&creatorId=xxx
// OR: ?startDate=...&endDate=...&creatorId=xxx
export async function GET(req: NextRequest) {
  const requestStart = Date.now();
  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;

  const startParam = req.nextUrl.searchParams.get("startDate");
  const endParam = req.nextUrl.searchParams.get("endDate");
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);

  let startDate: Date;
  let endDate: Date;

  if (startParam && endParam) {
    startDate = new Date(startParam);
    endDate = new Date(endParam);
  } else {
    endDate = new Date();
    startDate = new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000);
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
      return NextResponse.json({ daily: [] });
    }

    // Fetch chart data for all creators in parallel (batches of 5)
    const dailyMap = new Map<string, { sent: number; purchased: number; revenue: number }>();
    const batchSize = 5;

    for (let i = 0; i < validCreators.length; i += batchSize) {
      if (Date.now() - requestStart > 20000) break;

      const batch = validCreators.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(c => getMassMessageChartData(c.ofapiCreatorId, c.ofapiToken, startDate, endDate).catch(() => null))
      );

      for (const res of results) {
        if (!res) continue;
        const d = (res as any)?.data || res;

        // Parse sent chart — try multiple response shapes
        const sentChart = d?.group_messages?.chart || d?.sent?.chart || d?.chart || [];
        for (const pt of sentChart) {
          const date = String(pt.date || pt.x || "").split("T")[0];
          if (!date) continue;
          if (!dailyMap.has(date)) dailyMap.set(date, { sent: 0, purchased: 0, revenue: 0 });
          const entry = dailyMap.get(date)!;
          entry.sent += Number(pt.count || pt.y || pt.value || 0);
        }

        // Parse purchase chart
        const purchChart = d?.group_messages_purchases?.chart || d?.purchases?.chart || d?.purchaseChart || [];
        for (const pt of purchChart) {
          const date = String(pt.date || pt.x || "").split("T")[0];
          if (!date) continue;
          if (!dailyMap.has(date)) dailyMap.set(date, { sent: 0, purchased: 0, revenue: 0 });
          const entry = dailyMap.get(date)!;
          entry.purchased += Number(pt.count || pt.y || pt.value || 0);
          entry.revenue += Number(pt.amount || pt.revenue || 0);
        }
      }
    }

    // Convert to sorted array
    const daily: DailyPoint[] = [...dailyMap.entries()]
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const elapsed = Date.now() - requestStart;
    console.log(`[mass-chart] Done in ${elapsed}ms — ${validCreators.length} creators, ${daily.length} days`);

    return NextResponse.json({ daily });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mass-chart] Error:", msg);
    return NextResponse.json({ daily: [], error: msg });
  }
}

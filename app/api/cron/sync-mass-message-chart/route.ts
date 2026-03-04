import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMassMessageChartData } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/sync-mass-message-chart
 * Runs every 15 min. Pulls mass message chart data per creator from OFAPI.
 * Response shape (from OFAPI docs):
 * { data: { group_messages: { chart: [{ date, count }] },
 *           group_messages_purchases: { chart: [{ date, count }] } } }
 * Note: group_messages_purchases.chart[].count is revenue (dollars), not a count.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const creators = await prisma.creator.findMany({
      where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
      select: { id: true, ofapiCreatorId: true, ofapiToken: true },
    });

    const apiKey = process.env.OFAPI_API_KEY || "";
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let totalBuckets = 0;

    for (const creator of creators.slice(0, 10)) {
      const acctId = creator.ofapiCreatorId!;
      const token = creator.ofapiToken === "linked_via_auth_module" ? apiKey : creator.ofapiToken!;

      try {
        const raw = await getMassMessageChartData(acctId, token, startDate, now);

        // Parse per documented response shape
        const sentChart = raw?.data?.group_messages?.chart ?? raw?.group_messages?.chart ?? [];
        const revenueChart = raw?.data?.group_messages_purchases?.chart ?? raw?.group_messages_purchases?.chart ?? [];

        // Build date → { sentCount, purchaseAmount } map
        const buckets = new Map<string, { sent: number; revenue: number }>();

        for (const point of sentChart) {
          const date = point.date;
          if (!date) continue;
          const b = buckets.get(date) || { sent: 0, revenue: 0 };
          b.sent += point.count || 0;
          buckets.set(date, b);
        }

        for (const point of revenueChart) {
          const date = point.date;
          if (!date) continue;
          const b = buckets.get(date) || { sent: 0, revenue: 0 };
          // count in purchases chart = revenue amount (dollars), not a count
          b.revenue += point.count || 0;
          buckets.set(date, b);
        }

        for (const [dateStr, b] of buckets) {
          const hourBucket = new Date(dateStr);
          if (isNaN(hourBucket.getTime())) continue;

          await prisma.massMessageBucket.upsert({
            where: { creatorId_hourBucket: { creatorId: creator.id, hourBucket } },
            create: {
              creatorId: creator.id,
              hourBucket,
              sentCount: b.sent,
              purchaseCount: 0,
              purchaseAmount: b.revenue,
            },
            update: {
              sentCount: b.sent,
              purchaseAmount: b.revenue,
            },
          });
          totalBuckets++;
        }

        if (sentChart.length === 0 && revenueChart.length === 0) {
          console.log(`[sync-mass-chart] ${acctId}: empty chart response`);
        }
      } catch (e: any) {
        console.error(`[sync-mass-chart] Error for ${acctId}:`, e.message);
      }
    }

    console.log(`[sync-mass-chart] Upserted ${totalBuckets} buckets for ${Math.min(creators.length, 10)} creators`);
    return NextResponse.json({ status: "ok", buckets: totalBuckets });
  } catch (err: any) {
    console.error("[sync-mass-chart] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

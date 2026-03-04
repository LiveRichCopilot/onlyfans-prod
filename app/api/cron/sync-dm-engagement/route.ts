import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDirectMessageStats } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/sync-dm-engagement
 * Runs every 15 min. Pulls DM engagement stats per creator from OFAPI,
 * buckets by UK hour, upserts into DmEngagementBucket.
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
    // Query last 2 hours for overlap safety
    const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    let totalBuckets = 0;

    // Process max 10 creators per run to avoid timeout
    for (const creator of creators.slice(0, 10)) {
      const acctId = creator.ofapiCreatorId!;
      const token = creator.ofapiToken === "linked_via_auth_module" ? apiKey : creator.ofapiToken!;

      try {
        const data = await getDirectMessageStats(acctId, token, startDate, now, 100, 0);
        const messages = data?.data?.items ?? [];
        if (messages.length === 0) console.log(`[sync-dm-engagement] ${acctId}: 0 DM items returned`);

        // Bucket messages by UK hour
        const buckets = new Map<string, { dms: number; ppvs: number; purchases: number; revenue: number; views: number; chars: number }>();

        for (const m of messages) {
          const sentAt = new Date(m.date || m.createdAt);
          // Compute UK hour boundary
          const ukStr = sentAt.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false });
          const ukHour = parseInt(ukStr);
          const hourBucket = new Date(sentAt);
          hourBucket.setMinutes(0, 0, 0);

          const key = hourBucket.toISOString();
          const bucket = buckets.get(key) || { dms: 0, ppvs: 0, purchases: 0, revenue: 0, views: 0, chars: 0 };

          const price = typeof m.price === "string" ? parseFloat(m.price) : (m.price ?? 0);

          bucket.dms++;
          bucket.chars += (m.rawText || m.text || "").length;
          bucket.views += m.viewedCount || 0;
          if (price > 0) bucket.ppvs++;
          bucket.purchases += m.purchasedCount || 0;
          bucket.revenue += price * (m.purchasedCount || 0);

          buckets.set(key, bucket);
        }

        // Upsert each bucket
        for (const [key, b] of buckets) {
          await prisma.dmEngagementBucket.upsert({
            where: { creatorId_hourBucket: { creatorId: creator.id, hourBucket: new Date(key) } },
            create: {
              creatorId: creator.id,
              hourBucket: new Date(key),
              dmsSent: b.dms,
              ppvsSent: b.ppvs,
              purchaseCount: b.purchases,
              purchaseAmount: b.revenue,
              viewedCount: b.views,
              characterCount: b.chars,
            },
            update: {
              dmsSent: b.dms,
              ppvsSent: b.ppvs,
              purchaseCount: b.purchases,
              purchaseAmount: b.revenue,
              viewedCount: b.views,
              characterCount: b.chars,
            },
          });
          totalBuckets++;
        }
      } catch (e: any) {
        console.error(`[sync-dm-engagement] Error for ${acctId}:`, e.message);
      }
    }

    console.log(`[sync-dm-engagement] Upserted ${totalBuckets} buckets for ${Math.min(creators.length, 10)} creators`);
    return NextResponse.json({ status: "ok", buckets: totalBuckets });
  } catch (err: any) {
    console.error("[sync-dm-engagement] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

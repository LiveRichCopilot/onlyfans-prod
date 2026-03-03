import { NextRequest, NextResponse } from "next/server";
import { fetchOfapiData } from "@/lib/chatter-perf-fetch";
import { loadSessionData, attributeToChatter } from "@/lib/chatter-perf-attribute";
import { buildChatterRows, buildTotals } from "@/lib/chatter-perf-aggregate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chatter Performance API — 22 real stats per chatter
 *
 * Query params:
 *   startDate  (required) — ISO date string
 *   endDate    (required) — ISO date string
 *   creatorId  (optional) — filter to one creator/model
 */
export async function GET(req: NextRequest) {
  const startParam = req.nextUrl.searchParams.get("startDate");
  const endParam = req.nextUrl.searchParams.get("endDate");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 },
    );
  }

  const startDate = new Date(startParam);
  const endDate = new Date(endParam);
  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;
  const durationMs = endDate.getTime() - startDate.getTime();
  const daysInRange = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));

  // Comparison period: same duration before startDate
  const compStart = new Date(startDate.getTime() - durationMs);
  const compEnd = new Date(startDate.getTime());

  try {
    // Fetch OFAPI data + DB sessions in parallel
    const [ofapi, sessionData] = await Promise.all([
      fetchOfapiData(startDate, endDate, creatorId),
      loadSessionData(startDate, endDate, creatorId),
    ]);

    // Attribute everything to chatters
    const { chatterMap, tipShares } = await attributeToChatter(
      ofapi.messages,
      ofapi.creatorEarnings,
      ofapi.creators,
      sessionData.sessions,
      sessionData.scheduleMap,
      startDate,
      endDate,
    );

    // Build final rows + totals
    const rows = buildChatterRows(
      chatterMap, tipShares, sessionData.scheduleMap, daysInRange,
    );
    const totals = buildTotals(rows);

    // Diagnostics: compare OFAPI earnings vs attributed revenue
    for (const [cId, earnings] of ofapi.creatorEarnings) {
      const creatorName = ofapi.creators.find(c => c.id === cId)?.name || cId;
      const msgRev = ofapi.messages
        .filter(m => m.creatorId === cId)
        .reduce((s, m) => s + m.purchasedCount * m.price, 0);
      console.log(`[chatter-perf] ${creatorName}: OFAPI earnings=$${earnings.total}, msg revenue=$${msgRev.toFixed(2)}, tips=$${earnings.tips}`);
    }
    console.log(`[chatter-perf] Attributed total: $${totals.totalSales}, chatters: ${totals.activeChatters}`);

    return NextResponse.json({
      chatters: rows,
      totals,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        comparisonStartDate: compStart.toISOString(),
        comparisonEndDate: compEnd.toISOString(),
        daysInRange,
      },
    });
  } catch (err: any) {
    console.error("[chatter-performance] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

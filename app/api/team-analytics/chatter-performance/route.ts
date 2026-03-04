import { NextRequest, NextResponse } from "next/server";
import { fetchTransactionData } from "@/lib/chatter-perf-fetch";
import { loadSessionData, attributeToChatter } from "@/lib/chatter-perf-attribute";
import { buildChatterRows, buildTotals } from "@/lib/chatter-perf-aggregate";
import { aggregateHourlyStats } from "@/lib/chatter-perf-hourly-agg";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chatter Performance API — all 22 stats per chatter
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
    // Fetch transaction data + sessions + hourly activity in parallel
    const [txData, sessionData, hourlyAgg] = await Promise.all([
      fetchTransactionData(startDate, endDate, creatorId),
      loadSessionData(startDate, endDate, creatorId),
      aggregateHourlyStats(startDate, endDate, creatorId),
    ]);

    // Attribute transactions + sessions to chatters
    const { chatterMap } = await attributeToChatter(
      txData.transactions,
      txData.creators,
      sessionData.sessions,
      sessionData.scheduleMap,
      startDate,
      endDate,
      sessionData.scheduleShifts,
    );

    // Build final rows with all 22 stats
    const rows = buildChatterRows(chatterMap, sessionData.scheduleMap, daysInRange, hourlyAgg, sessionData.scheduledHoursMap);
    const totals = buildTotals(rows);

    console.log(`[chatter-perf] Result: $${totals.totalSales} gross, $${totals.netSales} net, ${totals.activeChatters} chatters, ${totals.txCount} tx`);

    return NextResponse.json({
      chatters: rows,
      totals,
      diagnostics: txData.diagnostics,
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

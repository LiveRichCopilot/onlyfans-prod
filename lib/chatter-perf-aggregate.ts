import type { ChatterStats } from "./chatter-perf-attribute";
import type { HourlyAggregation } from "./chatter-perf-hourly-agg";

/** Final row shape returned to the frontend — all 22 stats */
export type ChatterRow = {
  email: string;
  name: string;
  creators: string[];
  revenue: {
    totalSales: number;
    netSales: number;
    messageSales: number;
    tipSales: number;
    postSales: number;
  };
  activity: {
    txCount: number;
    messageTxCount: number;
    postTxCount: number;      // PPVs unlocked
    fansWhoSpent: number;
    dmsSent: number;           // from hourly scoring
    ppvsSent: number;          // from hourly scoring
    fansChatted: number;       // from hourly scoring
    characterCount: number;    // from hourly scoring
  };
  conversions: {
    avgPerSpender: number | null;
    goldenRatio: number | null;  // (ppvsSent / dmsSent) × 100
    unlockRate: number | null;   // (postTxCount / ppvsSent) × 100
    fanCVR: number | null;       // (fansWhoSpent / fansChatted) × 100
  };
  efficiency: {
    salesPerHour: number | null;
    messagesPerHour: number | null;
    fansPerHour: number | null;
  };
  time: {
    scheduledHours: number | null;
    clockedHours: number;
    avgResponseTimeSec: number | null;
  };
  attributionBreakdown: {
    override: number;
    hubstaff: number;
    unassigned: number;
  };
};

const OF_FEE = 0.20;

/** Build final rows from accumulated stats + hourly activity data */
export function buildChatterRows(
  chatterMap: Map<string, ChatterStats>,
  scheduleMap: Map<string, { name: string; shift: string }>,
  daysInRange: number,
  hourlyAgg?: Map<string, HourlyAggregation>,
  scheduledHoursMap?: Map<string, number>,
): ChatterRow[] {
  const rows: ChatterRow[] = [];

  for (const [email, stats] of chatterMap) {
    const clockedHours = stats.clockedSeconds / 3600;
    const totalSales = stats.messageSales + stats.tipSales + stats.postSales;
    const netSales = round2(totalSales * (1 - OF_FEE));
    const fansWhoSpent = stats.uniqueFans.size;

    // Hourly scoring data (DMs, PPVs, fans chatted, chars, response time)
    const hourly = hourlyAgg?.get(email);
    const dmsSent = hourly?.dmsSent || 0;
    const ppvsSent = hourly?.ppvsSent || 0;
    const fansChatted = hourly?.fansChatted || 0;
    const characterCount = hourly?.characterCount || 0;
    const avgResponseTimeSec = hourly?.avgResponseTimeSec ?? null;

    const scheduledHours = scheduledHoursMap?.get(email) ?? null;
    const postTxCount = stats.postTxCount || 0;

    // Conversions
    const avgPerSpender = fansWhoSpent > 0 ? round2(totalSales / fansWhoSpent) : null;
    const goldenRatio = dmsSent > 0 ? round2((ppvsSent / dmsSent) * 100) : null;
    const unlockRate = ppvsSent > 0 ? round2((postTxCount / ppvsSent) * 100) : null;
    const fanCVR = fansChatted > 0 ? round2((fansWhoSpent / fansChatted) * 100) : null;

    // Efficiency (only if clocked > 30 min)
    const salesPerHour = clockedHours > 0.5 ? round2(totalSales / clockedHours) : null;
    const messagesPerHour = clockedHours > 0.5 ? round2(dmsSent / clockedHours) : null;
    const fansPerHour = clockedHours > 0.5 ? round2(fansChatted / clockedHours) : null;

    // Attribution breakdown
    const attrTotal = stats.overrideHours + stats.hubstaffHours + stats.unassignedHours;
    const attributionBreakdown = attrTotal > 0 ? {
      override: Math.round((stats.overrideHours / attrTotal) * 100),
      hubstaff: Math.round((stats.hubstaffHours / attrTotal) * 100),
      unassigned: Math.round((stats.unassignedHours / attrTotal) * 100),
    } : { override: 0, hubstaff: 100, unassigned: 0 };

    rows.push({
      email,
      name: stats.name,
      creators: [...stats.creators],
      revenue: { totalSales: round2(totalSales), netSales, messageSales: round2(stats.messageSales), tipSales: round2(stats.tipSales), postSales: round2(stats.postSales) },
      activity: { txCount: stats.txCount, messageTxCount: stats.messageTxCount, postTxCount, fansWhoSpent, dmsSent, ppvsSent, fansChatted, characterCount },
      conversions: { avgPerSpender, goldenRatio, unlockRate, fanCVR },
      efficiency: { salesPerHour, messagesPerHour, fansPerHour },
      time: { scheduledHours, clockedHours: round2(clockedHours), avgResponseTimeSec },
      attributionBreakdown,
    });
  }

  return rows.sort((a, b) => b.revenue.totalSales - a.revenue.totalSales);
}

/** Compute totals across all chatters */
export function buildTotals(rows: ChatterRow[]) {
  const totalSales = round2(rows.reduce((s, r) => s + r.revenue.totalSales, 0));
  const clockedHours = round2(rows.reduce((s, r) => s + r.time.clockedHours, 0));
  return {
    totalSales,
    netSales: round2(totalSales * (1 - OF_FEE)),
    messageSales: round2(rows.reduce((s, r) => s + r.revenue.messageSales, 0)),
    tipSales: round2(rows.reduce((s, r) => s + r.revenue.tipSales, 0)),
    postSales: round2(rows.reduce((s, r) => s + r.revenue.postSales, 0)),
    txCount: rows.reduce((s, r) => s + r.activity.txCount, 0),
    fansWhoSpent: rows.reduce((s, r) => s + r.activity.fansWhoSpent, 0),
    clockedHours,
    activeChatters: rows.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

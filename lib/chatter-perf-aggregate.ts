import type { ChatterStats } from "./chatter-perf-attribute";

/** Final row shape returned to the frontend */
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
    fansWhoSpent: number;
  };
  conversions: {
    avgPerSpender: number | null;
  };
  efficiency: {
    salesPerHour: number | null;
  };
  time: {
    scheduledHours: number | null;
    clockedHours: number;
  };
  attributionBreakdown: {
    override: number;
    hubstaff: number;
    unassigned: number;
  };
};

const OF_FEE = 0.20; // OnlyFans takes 20%

/** Build final rows from accumulated stats */
export function buildChatterRows(
  chatterMap: Map<string, ChatterStats>,
  scheduleMap: Map<string, { name: string; shift: string }>,
  daysInRange: number,
): ChatterRow[] {
  const rows: ChatterRow[] = [];

  for (const [email, stats] of chatterMap) {
    const clockedHours = stats.clockedSeconds / 3600;
    const totalSales = stats.messageSales + stats.tipSales + stats.postSales;
    const netSales = round2(totalSales * (1 - OF_FEE));
    const fansWhoSpent = stats.uniqueFans.size;

    const avgPerSpender = fansWhoSpent > 0
      ? round2(totalSales / fansWhoSpent) : null;

    // Only compute if clocked > 30 min to avoid misleading ratios
    const salesPerHour = clockedHours > 0.5 ? round2(totalSales / clockedHours) : null;

    // Attribution breakdown percentages
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
      revenue: {
        totalSales: round2(totalSales),
        netSales,
        messageSales: round2(stats.messageSales),
        tipSales: round2(stats.tipSales),
        postSales: round2(stats.postSales),
      },
      activity: {
        txCount: stats.txCount,
        messageTxCount: stats.messageTxCount,
        fansWhoSpent,
      },
      conversions: {
        avgPerSpender,
      },
      efficiency: {
        salesPerHour,
      },
      time: {
        scheduledHours: null,
        clockedHours: round2(clockedHours),
      },
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

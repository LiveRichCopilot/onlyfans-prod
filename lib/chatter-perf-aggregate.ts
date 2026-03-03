import type { ChatterStats } from "./chatter-perf-attribute";

/** Final row shape returned to the frontend */
export type ChatterRow = {
  email: string;
  name: string;
  creators: string[];
  revenue: {
    totalSales: number;
    ppvSales: number;
    tips: number | null;
    directMsgSales: number;
    massSales: number;
  };
  activity: {
    dmsSent: number;
    directPpvsSent: number;
    ppvsUnlocked: number;
    fansChatted: number | null;
    fansWhoSpent: number;
    charCount: number;
  };
  conversions: {
    goldenRatio: number | null;
    unlockRate: number | null;
    fanCvr: number | null;
    avgEarningsPerSpender: number | null;
  };
  efficiency: {
    salesPerHour: number | null;
    msgsPerHour: number | null;
    fansPerHour: number | null;
  };
  time: {
    scheduledHours: number | null;
    clockedHours: number;
    avgResponseTime: number | null;
  };
  attributionBreakdown: {
    override: number;
    hubstaff: number;
    unassigned: number;
  };
};

/** Build final rows from accumulated stats */
export function buildChatterRows(
  chatterMap: Map<string, ChatterStats>,
  tipShares: Map<string, number>,
  scheduleMap: Map<string, { name: string; hoursPerShift: number | null }>,
  daysInRange: number,
): ChatterRow[] {
  const rows: ChatterRow[] = [];

  for (const [email, stats] of chatterMap) {
    const clockedHours = stats.clockedSeconds / 3600;
    const tipShare = tipShares.get(email) || 0;
    const ppvRevenue = stats.ppvSales + stats.massSales;
    const totalSales = ppvRevenue + tipShare;
    const fansWhoSpent = stats.spenderCount;

    // Conversions
    // Golden Ratio = PPVs Unlocked / Direct PPVs Sent (1:1 DMs only)
    const goldenRatio = stats.directPpvsSent > 0
      ? round1((stats.ppvsUnlocked / stats.directPpvsSent) * 100) : null;
    // Unlock Rate needs all PPVs sent (direct + mass) per chatter — not available yet
    const unlockRate: number | null = null;
    const avgEarningsPerSpender = fansWhoSpent > 0
      ? round2(totalSales / fansWhoSpent) : null;

    // Efficiency (only compute if clocked > 30 min to avoid misleading ratios)
    const salesPerHour = clockedHours > 0.5 ? round2(totalSales / clockedHours) : null;
    const msgsPerHour = clockedHours > 0.5 ? Math.round(stats.dmsSent / clockedHours) : null;

    // Scheduled hours estimate
    const sched = scheduleMap.get(email);
    const scheduledHours = sched?.hoursPerShift
      ? round1(sched.hoursPerShift * daysInRange) : null;

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
      revenue: {
        totalSales: round2(totalSales),
        ppvSales: round2(stats.ppvSales),
        tips: tipShare > 0 ? round2(tipShare) : null,
        directMsgSales: round2(stats.directMsgSales),
        massSales: round2(stats.massSales),
      },
      activity: {
        dmsSent: stats.dmsSent,
        directPpvsSent: stats.directPpvsSent,
        ppvsUnlocked: stats.ppvsUnlocked,
        fansChatted: null, // Too expensive for batch — requires listChats per creator
        fansWhoSpent,
        charCount: stats.charCount,
      },
      conversions: {
        goldenRatio,
        unlockRate,
        fanCvr: null, // Needs fansChatted
        avgEarningsPerSpender,
      },
      efficiency: {
        salesPerHour,
        msgsPerHour,
        fansPerHour: null, // Needs fansChatted
      },
      time: {
        scheduledHours,
        clockedHours: round2(clockedHours),
        avgResponseTime: null, // Available in ChatterHourlyScore — TODO
      },
      attributionBreakdown,
    });
  }

  return rows.sort((a, b) => b.revenue.totalSales - a.revenue.totalSales);
}

/** Compute totals across all chatters */
export function buildTotals(rows: ChatterRow[]) {
  return {
    totalSales: round2(rows.reduce((s, r) => s + r.revenue.totalSales, 0)),
    ppvSales: round2(rows.reduce((s, r) => s + r.revenue.ppvSales, 0)),
    dmsSent: rows.reduce((s, r) => s + r.activity.dmsSent, 0),
    ppvsUnlocked: rows.reduce((s, r) => s + r.activity.ppvsUnlocked, 0),
    clockedHours: round2(rows.reduce((s, r) => s + r.time.clockedHours, 0)),
    activeChatters: rows.length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

"use client";

import type { ChatterRowData } from "./ChatterPerfRow";

export type ColFormat = "money" | "int" | "percent" | "durationSec" | "hours" | "text";

export type ColDef = {
  key: string;
  label: string;
  format: ColFormat;
  getValue: (row: ChatterRowData) => number | string | null;
};

/** All stat columns matching the Infloww export */
export const ALL_COLUMNS: ColDef[] = [
  { key: "sales", label: "Sales", format: "money", getValue: r => r.revenue.totalSales },
  { key: "ppvSales", label: "PPV Sales", format: "money", getValue: r => r.revenue.postSales },
  { key: "tips", label: "Tips", format: "money", getValue: r => r.revenue.tipSales },
  { key: "dmSales", label: "DM Sales", format: "money", getValue: r => r.revenue.messageSales },
  { key: "dmsSent", label: "DMs Sent", format: "int", getValue: r => r.activity.dmsSent },
  { key: "ppvsSent", label: "PPVs Sent", format: "int", getValue: r => r.activity.ppvsSent },
  { key: "goldenRatio", label: "Golden Ratio", format: "percent", getValue: r => r.conversions.goldenRatio },
  { key: "ppvsUnlocked", label: "PPVs Unlocked", format: "int", getValue: r => r.activity.postTxCount },
  { key: "unlockRate", label: "Unlock Rate", format: "percent", getValue: r => r.conversions.unlockRate },
  { key: "priorityMass", label: "Priority Mass Sales", format: "money", getValue: () => null },
  { key: "ofMass", label: "OF Mass Sales", format: "money", getValue: () => null },
  { key: "fansChatted", label: "Fans Chatted", format: "int", getValue: r => r.activity.fansChatted },
  { key: "fansSpent", label: "Fans Spent", format: "int", getValue: r => r.activity.fansWhoSpent },
  { key: "fanCVR", label: "Fan CVR", format: "percent", getValue: r => r.conversions.fanCVR },
  { key: "avgPerFan", label: "$/Fan Spent", format: "money", getValue: r => r.conversions.avgPerSpender },
  { key: "charCount", label: "Chars", format: "int", getValue: r => r.activity.characterCount },
  { key: "respScheduled", label: "Resp (Sched)", format: "durationSec", getValue: r => r.time.avgResponseTimeSec },
  { key: "respClocked", label: "Resp (Clock)", format: "durationSec", getValue: r => r.time.avgResponseTimeSec },
  { key: "scheduledHrs", label: "Sched Hrs", format: "hours", getValue: r => r.time.scheduledHours },
  { key: "clockedHrs", label: "Clocked Hrs", format: "hours", getValue: r => r.time.clockedHours },
  { key: "salesPerHr", label: "$/Hr", format: "money", getValue: r => r.efficiency.salesPerHour },
  { key: "msgsPerHr", label: "Msgs/Hr", format: "int", getValue: r => r.efficiency.messagesPerHour },
  { key: "fansPerHr", label: "Fans/Hr", format: "int", getValue: r => r.efficiency.fansPerHour },
];

export function formatCell(value: number | string | null | undefined, format: ColFormat): string {
  if (value === null || value === undefined) return "—";
  if (format === "text") return String(value);

  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";

  switch (format) {
    case "int":
      return n.toLocaleString();
    case "money":
      if (n === 0) return "$0";
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case "percent":
      return `${n.toFixed(1)}%`;
    case "hours":
      if (n === 0) return "0h";
      return `${n.toFixed(n < 10 ? 1 : 0)}h`;
    case "durationSec":
      if (n === 0) return "0s";
      if (n < 60) return `${Math.round(n)}s`;
      if (n < 3600) return `${Math.round(n / 60)}m`;
      return `${(n / 3600).toFixed(1)}h`;
    default:
      return String(value);
  }
}

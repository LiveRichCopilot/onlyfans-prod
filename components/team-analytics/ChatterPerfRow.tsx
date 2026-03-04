"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { type ColDef, formatCell } from "./ChatterPerfColumns";

export type ChatterRowData = {
  email: string;
  name: string;
  creators: string[];
  revenue: { totalSales: number; netSales: number; messageSales: number; tipSales: number; postSales: number };
  activity: { txCount: number; messageTxCount: number; postTxCount: number; fansWhoSpent: number; dmsSent: number; ppvsSent: number; fansChatted: number; characterCount: number };
  conversions: { avgPerSpender: number | null; goldenRatio: number | null; unlockRate: number | null; fanCVR: number | null };
  efficiency: { salesPerHour: number | null; messagesPerHour: number | null; fansPerHour: number | null };
  time: { scheduledHours: number | null; clockedHours: number; avgResponseTimeSec: number | null };
  attributionBreakdown: { override: number; hubstaff: number; unassigned: number };
};

export function ChatterPerfRow({
  row,
  columns,
  colCount,
  onNameClick,
}: {
  row: ChatterRowData;
  columns: ColDef[];
  colCount: number;
  onNameClick?: (email: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition">
        <td className="px-3 py-2.5 w-8">
          <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>

        <td className="px-3 py-2.5 sticky left-0 z-10 bg-[#0a0a0f]">
          <button onClick={() => onNameClick?.(row.email)} className="text-left hover:text-teal-400 transition">
            <div className="text-sm font-medium text-white/90">{row.name}</div>
            <div className="text-[10px] text-white/30">{row.email}</div>
          </button>
        </td>

        <td className="px-3 py-2.5 sticky left-[180px] z-10 bg-[#0a0a0f]">
          <div className="text-xs text-white/50 max-w-[120px] truncate" title={row.creators.join(", ")}>
            {row.creators.join(", ") || "—"}
          </div>
        </td>

        {columns.map(col => {
          const raw = col.getValue(row);
          const display = formatCell(raw, col.format);
          const isMoney = col.format === "money";
          const isNull = raw === null || raw === undefined;
          const isZero = raw === 0 || isNull;
          return (
            <td key={col.key} className="px-3 py-2.5 text-sm whitespace-nowrap">
              <span className={`tabular-nums ${isMoney && !isZero ? "text-teal-400 font-medium" : isZero ? "text-white/20" : "text-white/80"}`}>
                {display}
              </span>
            </td>
          );
        })}
      </tr>

      {expanded && (
        <tr>
          <td colSpan={colCount} className="px-6 py-3 bg-white/[0.02]">
            <div className="text-xs text-white/40 italic">Hourly breakdown coming soon.</div>
          </td>
        </tr>
      )}
    </>
  );
}

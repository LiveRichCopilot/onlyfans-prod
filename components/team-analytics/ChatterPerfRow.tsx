"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

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

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-sm whitespace-nowrap ${className}`}>{children}</td>;
}

function Metric({ value, prefix = "", suffix = "" }: { value: number | null; prefix?: string; suffix?: string }) {
  if (value === null || value === undefined) return <span className="text-white/20">&mdash;</span>;
  return <span className="text-white/80 tabular-nums">{prefix}{value.toLocaleString()}{suffix}</span>;
}

function MoneyCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-white/20">&mdash;</span>;
  if (value === 0) return <span className="text-white/30">$0</span>;
  return (
    <span className={`tabular-nums font-medium ${value > 0 ? "text-teal-400" : "text-white/60"}`}>
      ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
    </span>
  );
}

export function ChatterPerfRow({
  row,
  colCount,
  onNameClick,
}: {
  row: ChatterRowData;
  colCount: number;
  onNameClick?: (email: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition">
        {/* Expand chevron */}
        <Cell className="w-8">
          <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </Cell>

        {/* Employee — sticky */}
        <td className="px-3 py-2.5 sticky left-0 z-10 bg-[#0a0a0f]">
          <button
            onClick={() => onNameClick?.(row.email)}
            className="text-left hover:text-teal-400 transition"
          >
            <div className="text-sm font-medium text-white/90">{row.name}</div>
            <div className="text-[10px] text-white/30">{row.email}</div>
          </button>
        </td>

        {/* Creators — sticky */}
        <td className="px-3 py-2.5 sticky left-[180px] z-10 bg-[#0a0a0f]">
          <div className="text-xs text-white/50 max-w-[120px] truncate" title={row.creators.join(", ")}>
            {row.creators.join(", ") || "&mdash;"}
          </div>
        </td>

        {/* Revenue — Gross */}
        <Cell><MoneyCell value={row.revenue.totalSales} /></Cell>
        <Cell><MoneyCell value={row.revenue.netSales} /></Cell>
        <Cell><MoneyCell value={row.revenue.messageSales} /></Cell>
        <Cell><MoneyCell value={row.revenue.tipSales} /></Cell>
        <Cell><MoneyCell value={row.revenue.postSales} /></Cell>

        {/* Activity */}
        <Cell><Metric value={row.activity.txCount} /></Cell>
        <Cell><Metric value={row.activity.messageTxCount} /></Cell>
        <Cell><Metric value={row.activity.fansWhoSpent} /></Cell>

        {/* Conversions + Efficiency */}
        <Cell><Metric value={row.conversions.avgPerSpender} prefix="$" /></Cell>
        <Cell><Metric value={row.efficiency.salesPerHour} prefix="$" /></Cell>
        <Cell><Metric value={row.time.clockedHours} suffix="h" /></Cell>
      </tr>

      {/* Expanded: hourly breakdown placeholder */}
      {expanded && (
        <tr>
          <td colSpan={colCount} className="px-6 py-3 bg-white/[0.02]">
            <div className="text-xs text-white/40 italic">
              Hourly breakdown coming soon.
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ArrowUpDown, Users, DollarSign, Target, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { ChatterPerfRow, type ChatterRowData } from "./ChatterPerfRow";
import { ExportButtons } from "./ExportButtons";

type SortField = "name" | "totalSales" | "netSales" | "messageSales" | "tipSales" | "clockedHours" | "salesPerHour";
type SortDir = "asc" | "desc";

function getSortValue(row: ChatterRowData, field: SortField): number {
  switch (field) {
    case "name": return 0;
    case "totalSales": return row.revenue.totalSales;
    case "netSales": return row.revenue.netSales;
    case "messageSales": return row.revenue.messageSales;
    case "tipSales": return row.revenue.tipSales;
    case "clockedHours": return row.time.clockedHours;
    case "salesPerHour": return row.efficiency.salesPerHour ?? -Infinity;
    default: return 0;
  }
}

type Props = {
  creatorFilter?: string;
  onChatterClick?: (email: string, creatorId?: string) => void;
};

type Totals = {
  totalSales: number;
  netSales: number;
  messageSales: number;
  tipSales: number;
  postSales: number;
  txCount: number;
  fansWhoSpent: number;
  clockedHours: number;
  activeChatters: number;
};

export function ChatterPerformanceTable({ creatorFilter, onChatterClick }: Props) {
  const [data, setData] = useState<ChatterRowData[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("totalSales");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    label: "7d",
    days: 7,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (creatorFilter && creatorFilter !== "all") {
        params.set("creatorId", creatorFilter);
      }
      const res = await fetch(`/api/team-analytics/chatter-performance?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.chatters || []);
      setTotals(json.totals || null);
    } catch (e: any) {
      setError(e.message);
      setData([]);
      setTotals(null);
    }
    setLoading(false);
  }, [dateRange, creatorFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (sortField === "name") {
      return sortDir === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    const va = getSortValue(a, sortField);
    const vb = getSortValue(b, sortField);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const HEADER_LABELS = [
    "", "Employee", "Creators",
    "Gross", "Net", "Messages", "Tips", "Posts",
    "Tx", "Msg Tx", "Fans Spent",
    "$/Spender", "$/Hr", "Hours",
  ];

  const SORT_FIELDS: (SortField | null)[] = [
    null, "name", null,
    "totalSales", "netSales", "messageSales", "tipSales", null,
    null, null, null,
    null, "salesPerHour", "clockedHours",
  ];

  const COL_COUNT = HEADER_LABELS.length;

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      {/* Header — click to expand */}
      <button onClick={() => setSectionOpen(!sectionOpen)} className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-white/[0.02] transition">
        <div className="flex items-center gap-3">
          <Users size={16} className="text-teal-400" />
          <div>
            <h3 className="text-white font-semibold text-sm">Chatter Performance</h3>
            <p className="text-white/40 text-[10px]">
              {data.length} chatters · {dateRange.label}
              {totals && ` · $${totals.totalSales.toLocaleString()} gross`}
              {loading && " · loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sectionOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
        </div>
      </button>

      {!sectionOpen ? null : <>

      {/* Controls */}
      <div className="flex items-center justify-end gap-2 px-6 py-2 border-t border-white/5">
        <ExportButtons data={data} filename="chatter-performance" />
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <button onClick={load} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Revenue KPI Pills */}
      {totals && !loading && (
        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-teal-400/60" />
            <div>
              <div className="text-lg font-bold text-teal-400 tabular-nums">${totals.totalSales.toLocaleString()}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Gross Sales</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-white/30" />
            <div>
              <div className="text-lg font-bold text-white tabular-nums">${totals.netSales.toLocaleString()}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Net (after 20%)</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Target size={14} className="text-teal-400/60" />
            <div>
              <div className="text-lg font-bold text-white tabular-nums">{totals.txCount.toLocaleString()}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Transactions</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-teal-400/60" />
            <div>
              <div className="text-lg font-bold text-white tabular-nums">
                {totals.clockedHours > 0 ? `$${Math.round(totals.totalSales / totals.clockedHours).toLocaleString()}` : "\u2014"}
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Avg $/Hour</div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="px-6 py-3 text-red-400 text-xs">Error: {error}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              {HEADER_LABELS.map((label, i) => {
                const sf = SORT_FIELDS[i];
                const isActive = sf === sortField;
                const stickyClass = i === 1 ? "sticky left-0 z-20 bg-[#0a0a0f]"
                  : i === 2 ? "sticky left-[180px] z-20 bg-[#0a0a0f]" : "";
                return (
                  <th
                    key={i}
                    className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${stickyClass} ${
                      isActive ? "text-teal-400" : "text-white/40"
                    } ${sf ? "cursor-pointer hover:text-white/70" : ""}`}
                    onClick={() => sf && toggleSort(sf)}
                  >
                    <span className="flex items-center gap-0.5">
                      {label}
                      {sf && <ArrowUpDown size={9} className="opacity-40" />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="px-6 py-12 text-center text-white/30 text-sm">
                  <RefreshCw size={16} className="inline animate-spin mr-2" />
                  Loading chatter stats...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="px-6 py-12 text-center text-white/30 text-sm">
                  No chatter data for this date range.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <ChatterPerfRow
                  key={row.email}
                  row={row}
                  colCount={COL_COUNT}
                  onNameClick={(email) => onChatterClick?.(email)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>}
    </div>
  );
}

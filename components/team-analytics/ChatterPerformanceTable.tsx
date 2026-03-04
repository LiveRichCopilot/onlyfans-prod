"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ArrowUpDown, Users, DollarSign, Target, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { ChatterPerfRow, type ChatterRowData } from "./ChatterPerfRow";
import { ExportButtons } from "./ExportButtons";
import { ALL_COLUMNS, type ColDef } from "./ChatterPerfColumns";

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
  const [sortKey, setSortKey] = useState("sales");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortCol = ALL_COLUMNS.find(c => c.key === sortKey);
  const sorted = [...data].sort((a, b) => {
    if (sortKey === "name") return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    if (!sortCol) return 0;
    const va = Number(sortCol.getValue(a) ?? -Infinity);
    const vb = Number(sortCol.getValue(b) ?? -Infinity);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const columns = ALL_COLUMNS;
  const COL_COUNT = 3 + columns.length;

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

      {/* Table — all 23 stat columns, horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/40 sticky left-0 z-20 bg-[#0a0a0f] cursor-pointer hover:text-white/70" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-0.5">Employee {sortKey === "name" && <ArrowUpDown size={9} className="text-teal-400" />}</span>
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/40 sticky left-[180px] z-20 bg-[#0a0a0f]">Creators</th>
              {columns.map(c => (
                <th key={c.key}
                  className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-white/70 ${sortKey === c.key ? "text-teal-400" : "text-white/40"}`}
                  onClick={() => toggleSort(c.key)}
                >
                  <span className="flex items-center gap-0.5">
                    {c.label}
                    <ArrowUpDown size={9} className="opacity-40" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 ? (
              <tr><td colSpan={COL_COUNT} className="px-6 py-12 text-center text-white/30 text-sm">
                <RefreshCw size={16} className="inline animate-spin mr-2" />Loading...
              </td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={COL_COUNT} className="px-6 py-12 text-center text-white/30 text-sm">No data for this range.</td></tr>
            ) : sorted.map(row => (
              <ChatterPerfRow key={row.email} row={row} columns={columns} colCount={COL_COUNT} onNameClick={(email) => onChatterClick?.(email)} />
            ))}
          </tbody>
        </table>
      </div>
    </>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { scoreColor } from "./chart-colors";

type ChatterEntry = {
  name: string;
  email: string;
  creator: string;
  avgScore: number;
  totalSessions: number;
  improvementIndex: number;
  totalHours?: number;
};

type Props = {
  data: ChatterEntry[];
  onChatterClick?: (email: string) => void;
};

type SortField = "name" | "creator" | "avgScore" | "totalSessions" | "totalHours" | "improvementIndex";

const COLLAPSED_COUNT = 8;

export function ChatterComparisonBar({ data, onChatterClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortField, setSortField] = useState<SortField>("avgScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const showToggle = data.length > COLLAPSED_COUNT;
  const visible = expanded ? data : data.slice(0, COLLAPSED_COUNT);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "creator" ? "asc" : "desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortField] ?? 0;
    const bv = b[sortField] ?? 0;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Chatter Rankings</h3>
          <p className="text-white/40 text-xs mt-0.5">
            Average score per chatter
            {onChatterClick && <span className="text-teal-400/50 ml-1">— click row for shift report</span>}
          </p>
        </div>
        <ExportButtons data={data} filename="chatter-rankings" />
      </div>

      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-white/30 text-sm">No chatter profiles yet</div>
      ) : (
        <>
          {/* Bar chart — top performers */}
          <ResponsiveContainer width="100%" height={visible.length * 32}>
            <BarChart data={visible} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} width={100} />
              <Tooltip content={<GlassTooltip />} />
              <Bar dataKey="avgScore" name="Score" radius={[0, 6, 6, 0]} barSize={16}>
                {visible.map((entry, i) => <Cell key={i} fill={scoreColor(entry.avgScore)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {showToggle && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-white/40 hover:text-white/70 transition"
            >
              {expanded ? <><ChevronUp size={14} /> Show top {COLLAPSED_COUNT}</> : <><ChevronDown size={14} /> Show all {data.length} chatters</>}
            </button>
          )}

          {/* Score legend */}
          <div className="mt-3 border-t border-white/5 pt-3">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <span className="text-[10px] text-white/40">AI Score (0-100):</span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: "#34D399" }} />
                <span className="text-white/60">80+ Excellent</span>
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: "#2DD4BF" }} />
                <span className="text-white/60">60-79 Good</span>
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: "#FBBF24" }} />
                <span className="text-white/60">40-59 Needs Work</span>
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ background: "#F87171" }} />
                <span className="text-white/60">Under 40 Poor</span>
              </span>
            </div>

            {/* Sortable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {([
                      ["name", "Name"],
                      ["creator", "Creator"],
                      ["avgScore", "Score"],
                      ["totalSessions", "Sessions"],
                      ["totalHours", "Hours"],
                      ["improvementIndex", "Trend"],
                    ] as [SortField, string][]).map(([field, label]) => (
                      <th
                        key={field}
                        onClick={() => toggleSort(field)}
                        className="text-left text-white/50 font-medium py-2 px-2 cursor-pointer hover:text-white/80 transition select-none"
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortField === field && (
                            <span className="text-teal-400 text-[9px]">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr
                      key={`${c.email}-${c.creator}`}
                      onClick={() => onChatterClick?.(c.email)}
                      className={`border-b border-white/5 ${onChatterClick ? "cursor-pointer hover:bg-white/5" : ""} transition`}
                    >
                      <td className="py-2 px-2">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: scoreColor(c.avgScore) }} />
                          <span className="text-white/80">{c.name}</span>
                        </span>
                      </td>
                      <td className="py-2 px-2 text-white/50 max-w-[120px] truncate">{c.creator}</td>
                      <td className="py-2 px-2">
                        <span className="font-bold tabular-nums" style={{ color: scoreColor(c.avgScore) }}>{c.avgScore}</span>
                      </td>
                      <td className="py-2 px-2 text-white/60 tabular-nums">{c.totalSessions}</td>
                      <td className="py-2 px-2 text-white/60 tabular-nums">{c.totalHours ?? 0}h</td>
                      <td className="py-2 px-2">
                        <span className={`flex items-center gap-0.5 ${c.improvementIndex > 0 ? "text-emerald-400" : c.improvementIndex < 0 ? "text-red-400" : "text-white/30"}`}>
                          {c.improvementIndex > 0 ? "\u2191" : c.improvementIndex < 0 ? "\u2193" : "\u2014"}
                          {c.improvementIndex !== 0 && <span className="tabular-nums">{Math.abs(c.improvementIndex)}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

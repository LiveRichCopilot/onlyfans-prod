"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChevronDown, TrendingUp } from "lucide-react";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { CHART_COLORS } from "./chart-colors";

type TrendPoint = {
  date: string;
  avgScore: number;
  sessionCount: number;
  avgSla: number;
  avgFollowup: number;
  avgTrigger: number;
  avgQuality: number;
  avgRevenue: number;
};

export function PerformanceTrendChart({ data }: { data: TrendPoint[] }) {
  const hasMeaningfulData = data.length >= 2;
  const [expanded, setExpanded] = useState(hasMeaningfulData);

  // Collapsed state for sparse data
  if (!expanded) {
    const latestScore = data.length > 0 ? data[data.length - 1].avgScore : 0;
    const sessions = data.reduce((s, d) => s + d.sessionCount, 0);
    return (
      <div className="glass-card rounded-3xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={14} className="text-white/20" />
          <span className="text-white/40 text-xs font-medium">Performance Trend</span>
          {data.length > 0 ? (
            <span className="text-white/20 text-[10px]">
              {data.length} day{data.length !== 1 ? "s" : ""} of data — avg score: <span className="text-teal-400/60 font-semibold">{Math.round(latestScore)}/100</span> — {sessions} sessions scored
            </span>
          ) : (
            <span className="text-white/20 text-[10px]">No scoring data yet — scores appear after chatters are scored hourly</span>
          )}
        </div>
        <button onClick={() => setExpanded(true)} className="text-white/20 hover:text-white/40">
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Performance Trend</h3>
          <p className="text-white/40 text-xs mt-0.5">Daily average scores</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons data={data} filename="performance-trend" />
          <button onClick={() => setExpanded(false)} className="text-white/20 hover:text-white/40">
            <ChevronDown size={14} className="rotate-180" />
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center text-white/30 text-xs">
          No scoring data yet — scores appear after chatters are scored hourly
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSla" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
            <Tooltip content={<GlassTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }} />
            <Area type="monotone" dataKey="avgScore" name="Overall" stroke={CHART_COLORS.teal} fill="url(#gradScore)" strokeWidth={2} />
            <Area type="monotone" dataKey="avgSla" name="SLA" stroke={CHART_COLORS.blue} fill="url(#gradSla)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="avgQuality" name="Quality" stroke={CHART_COLORS.purple} fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

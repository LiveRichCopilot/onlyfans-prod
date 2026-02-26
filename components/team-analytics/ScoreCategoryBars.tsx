"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { CHART_COLORS } from "./chart-colors";

type CategoryAverages = {
  sla: number;
  followup: number;
  trigger: number;
  quality: number;
  revenue: number;
};

const CATEGORIES = [
  { key: "sla", label: "SLA", hint: "Response speed", max: 25, color: CHART_COLORS.blue },
  { key: "followup", label: "Follow-up", hint: "Re-engaging quiet fans", max: 20, color: CHART_COLORS.teal },
  { key: "trigger", label: "Triggers", hint: "Catching buying signals", max: 20, color: CHART_COLORS.purple },
  { key: "quality", label: "Quality", hint: "Message creativity & persona", max: 20, color: CHART_COLORS.amber },
  { key: "revenue", label: "Revenue", hint: "Actually making sales", max: 15, color: CHART_COLORS.emerald },
];

export function ScoreCategoryBars({ data }: { data: CategoryAverages }) {
  const chartData = CATEGORIES.map(c => ({
    name: c.label,
    score: data[c.key as keyof CategoryAverages],
    max: c.max,
    color: c.color,
    pct: Math.round((data[c.key as keyof CategoryAverages] / c.max) * 100),
  }));

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Score Breakdown</h3>
          <p className="text-white/40 text-xs mt-0.5">How the team scores in each area — higher bars = better performance</p>
        </div>
        <ExportButtons data={chartData} filename="score-breakdown" columns={["name", "score", "max", "pct"]} />
      </div>
      <div className="space-y-3">
        {chartData.map(c => (
          <div key={c.name}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/60">{c.name} <span className="text-white/25 text-[10px] ml-1">{c.hint}</span></span>
              <span className="text-white/40 tabular-nums">{c.score}/{c.max}</span>
            </div>
            <div className="h-2.5 glass-inset rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

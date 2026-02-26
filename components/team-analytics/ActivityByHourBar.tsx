"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { CHART_COLORS } from "./chart-colors";

type HourEntry = { hour: number; sessionCount: number; avgScore: number };

export function ActivityByHourBar({ data }: { data: HourEntry[] }) {
  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Activity by Hour</h3>
          <p className="text-white/40 text-xs mt-0.5">When chatters are active (UK time) — gaps mean nobody's working that hour</p>
        </div>
        <ExportButtons data={data.map(d => ({ hour: `${d.hour}:00`, sessions: d.sessionCount, avgScore: d.avgScore }))} filename="activity-by-hour" />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickFormatter={h => `${h}:00`} />
          <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
          <Tooltip content={<GlassTooltip />} />
          <Bar dataKey="sessionCount" name="Sessions" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

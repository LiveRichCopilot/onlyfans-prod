"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { COLOR_ARRAY } from "./chart-colors";

export function HoursStackedArea({ data }: { data: Record<string, any>[] }) {
  if (data.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-6">
        <h3 className="text-white font-semibold text-sm mb-2">Hours Worked</h3>
        <div className="h-[220px] flex items-center justify-center text-white/30 text-sm">No session data yet</div>
      </div>
    );
  }

  // Get all chatter keys (everything except "date")
  const chatters = Object.keys(data[0]).filter(k => k !== "date");

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Hours Worked</h3>
          <p className="text-white/40 text-xs mt-0.5">Daily hours stacked by chatter</p>
        </div>
        <ExportButtons data={data} filename="hours-over-time" />
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} unit="h" />
          <Tooltip content={<GlassTooltip formatter={(v: number) => `${parseFloat(v.toFixed(1))}h`} />} />
          <Legend wrapperStyle={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }} />
          {chatters.slice(0, 10).map((name, i) => (
            <Area key={name} type="monotone" dataKey={name} stackId="1" stroke={COLOR_ARRAY[i % COLOR_ARRAY.length]} fill={COLOR_ARRAY[i % COLOR_ARRAY.length]} fillOpacity={0.3} strokeWidth={1.5} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

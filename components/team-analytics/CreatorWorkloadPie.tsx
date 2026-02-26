"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { COLOR_ARRAY } from "./chart-colors";

type WorkloadEntry = { creatorName: string; sessionCount: number; totalHours: number };

export function CreatorWorkloadPie({ data }: { data: WorkloadEntry[] }) {
  const totalHours = data.reduce((s, d) => s + d.totalHours, 0);

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Creator Workload</h3>
          <p className="text-white/40 text-xs mt-0.5">Total chatter hours assigned to each model/creator account</p>
        </div>
        <ExportButtons data={data} filename="creator-workload" />
      </div>
      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-white/30 text-sm">No session data yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="totalHours" nameKey="creatorName" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={COLOR_ARRAY[i % COLOR_ARRAY.length]} />)}
                </Pie>
                <Tooltip content={<GlassTooltip formatter={(v: number) => `${v}h`} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.map((d, i) => (
              <div key={d.creatorName} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_ARRAY[i % COLOR_ARRAY.length] }} />
                <span className="text-white/70 truncate flex-1">{d.creatorName}</span>
                <span className="text-white/40 tabular-nums">{d.totalHours}h</span>
                <span className="text-white/20 tabular-nums">{totalHours > 0 ? Math.round(d.totalHours / totalHours * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

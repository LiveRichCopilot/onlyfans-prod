"use client";

import { ExportButtons } from "./ExportButtons";
import { COLOR_ARRAY } from "./chart-colors";

type WorkloadEntry = { creatorName: string; sessionCount: number; totalHours: number };

export function CreatorWorkloadPie({ data }: { data: WorkloadEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-6">
        <h3 className="text-white font-semibold text-sm">Creator Workload</h3>
        <div className="h-[160px] flex items-center justify-center text-white/30 text-sm">No session data yet</div>
      </div>
    );
  }

  // Sort by sessions descending — most active creators first
  const sorted = [...data].sort((a, b) => b.sessionCount - a.sessionCount);
  const maxHours = Math.max(...sorted.map(d => d.totalHours), 1);

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Creator Workload</h3>
          <p className="text-white/40 text-xs mt-0.5">Chatter sessions and hours per creator this period</p>
        </div>
        <ExportButtons data={data} filename="creator-workload" />
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sorted.map((d, i) => {
          const barPct = Math.max(5, (d.totalHours / maxHours) * 100);
          const avgHrsPerSession = d.sessionCount > 0 ? (d.totalHours / d.sessionCount).toFixed(1) : "0";
          return (
            <div key={d.creatorName} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_ARRAY[i % COLOR_ARRAY.length] }} />
                  <span className="text-white/80 text-sm truncate">{d.creatorName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-sm tabular-nums">
                  <span className="text-white/90 font-medium">{d.sessionCount} shifts</span>
                  <span className="text-white/50">{d.totalHours}h total</span>
                  <span className="text-white/40 text-xs">~{avgHrsPerSession}h/shift</span>
                </div>
              </div>
              <div className="h-2 glass-inset rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: COLOR_ARRAY[i % COLOR_ARRAY.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

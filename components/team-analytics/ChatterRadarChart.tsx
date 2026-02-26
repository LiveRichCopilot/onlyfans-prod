"use client";

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { COLOR_ARRAY } from "./chart-colors";

type ChatterRadarEntry = {
  name: string;
  sla: number;
  followup: number;
  trigger: number;
  quality: number;
  revenue: number;
};

export function ChatterRadarChart({ data }: { data: ChatterRadarEntry[] }) {
  // Reshape for radar: each axis is a category, each series is a chatter
  const axes = ["SLA", "Follow-up", "Triggers", "Quality", "Revenue"];
  const keys = ["sla", "followup", "trigger", "quality", "revenue"] as const;

  const radarData = axes.map((axis, i) => {
    const point: Record<string, any> = { category: axis };
    data.forEach(c => { point[c.name] = c[keys[i]]; });
    return point;
  });

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Skill Radar</h3>
          <p className="text-white/40 text-xs mt-0.5">Compares each chatter across all 5 scoring areas — bigger shape = better overall</p>
        </div>
        <ExportButtons data={data} filename="chatter-radar" />
      </div>
      {data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-white/30 text-sm">No profile data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="category" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 25]} tick={false} />
            <Tooltip content={<GlassTooltip />} />
            {data.slice(0, 5).map((c, i) => (
              <Radar key={c.name} name={c.name} dataKey={c.name} stroke={COLOR_ARRAY[i]} fill={COLOR_ARRAY[i]} fillOpacity={0.1} strokeWidth={2} />
            ))}
            <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

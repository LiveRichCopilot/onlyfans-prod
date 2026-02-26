"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { ExportButtons } from "./ExportButtons";
import { scoreColor, CHART_COLORS } from "./chart-colors";

type Props = {
  avgScore: number;
  categoryAverages: { sla: number; followup: number; trigger: number; quality: number; revenue: number };
};

function GaugeRing({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const data = [{ value: pct, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="w-[100px] h-[100px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={data} barSize={8}>
            <RadialBar background={{ fill: "rgba(255,255,255,0.05)" }} dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pt-2">
          <span className="text-lg font-bold tabular-nums" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/40 mt-1">{label}</span>
    </div>
  );
}

export function TeamGaugePanel({ avgScore, categoryAverages }: Props) {
  const exportData = [
    { metric: "Team Average", value: avgScore, max: 100 },
    { metric: "SLA", value: categoryAverages.sla, max: 25 },
    { metric: "Follow-up", value: categoryAverages.followup, max: 20 },
    { metric: "Triggers", value: categoryAverages.trigger, max: 20 },
    { metric: "Quality", value: categoryAverages.quality, max: 20 },
    { metric: "Revenue", value: categoryAverages.revenue, max: 15 },
  ];

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Team Gauges</h3>
          <p className="text-white/40 text-xs mt-0.5">At-a-glance score dials</p>
        </div>
        <ExportButtons data={exportData} filename="team-gauges" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <GaugeRing value={avgScore} max={100} label="Overall" color={scoreColor(avgScore)} />
        <GaugeRing value={categoryAverages.sla} max={25} label="SLA" color={CHART_COLORS.blue} />
        <GaugeRing value={categoryAverages.followup} max={20} label="Follow-up" color={CHART_COLORS.teal} />
        <GaugeRing value={categoryAverages.trigger} max={20} label="Triggers" color={CHART_COLORS.purple} />
        <GaugeRing value={categoryAverages.quality} max={20} label="Quality" color={CHART_COLORS.amber} />
        <GaugeRing value={categoryAverages.revenue} max={15} label="Revenue" color={CHART_COLORS.emerald} />
      </div>
    </div>
  );
}

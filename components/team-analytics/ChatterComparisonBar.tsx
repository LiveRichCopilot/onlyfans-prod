"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
};

export function ChatterComparisonBar({ data }: { data: ChatterEntry[] }) {
  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Chatter Rankings</h3>
          <p className="text-white/40 text-xs mt-0.5">Average score per chatter</p>
        </div>
        <ExportButtons data={data} filename="chatter-rankings" />
      </div>
      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-white/30 text-sm">No chatter profiles yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(250, data.length * 35)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} width={100} />
            <Tooltip content={<GlassTooltip />} />
            <Bar dataKey="avgScore" name="Score" radius={[0, 6, 6, 0]} barSize={18}>
              {data.map((entry, i) => <Cell key={i} fill={scoreColor(entry.avgScore)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

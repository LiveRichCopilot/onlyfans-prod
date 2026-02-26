"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlassTooltip } from "./ChartTooltip";
import { ExportButtons } from "./ExportButtons";
import { COLOR_ARRAY } from "./chart-colors";

type ArchetypeEntry = { archetype: string; count: number };

const ARCHETYPE_LABELS: Record<string, string> = {
  chameleon: "Chameleon",
  sweetheart: "Sweetheart",
  aggressor: "Aggressor",
  tease: "Tease",
  yes_babe_robot: "Yes Babe Robot",
  interview_bot: "Interview Bot",
  doormat: "Doormat",
  fact_bot: "Fact Bot",
  friend_zone: "Friend Zone",
  vending_machine: "Vending Machine",
};

export function ArchetypePieChart({ data }: { data: ArchetypeEntry[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Chatter Archetypes</h3>
          <p className="text-white/40 text-xs mt-0.5">AI-detected chatting personality styles — "Tease" sells well, "Friend Zone" doesn't</p>
        </div>
        <ExportButtons data={data.map(d => ({ archetype: ARCHETYPE_LABELS[d.archetype] || d.archetype, count: d.count }))} filename="archetype-distribution" />
      </div>
      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-white/30 text-sm">No archetypes detected yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-[180px] h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="archetype" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={COLOR_ARRAY[i % COLOR_ARRAY.length]} />)}
                </Pie>
                <Tooltip content={<GlassTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.slice(0, 6).map((d, i) => (
              <div key={d.archetype} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_ARRAY[i % COLOR_ARRAY.length] }} />
                <span className="text-white/70 truncate flex-1">{ARCHETYPE_LABELS[d.archetype] || d.archetype}</span>
                <span className="text-white/40 tabular-nums">{Math.round(d.count / total * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
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

type Props = {
  data: ChatterEntry[];
  onChatterClick?: (email: string) => void;
};

const COLLAPSED_COUNT = 8;

export function ChatterComparisonBar({ data, onChatterClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const showToggle = data.length > COLLAPSED_COUNT;
  const visible = expanded ? data : data.slice(0, COLLAPSED_COUNT);

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Chatter Rankings</h3>
          <p className="text-white/40 text-xs mt-0.5">
            Average score per chatter
            {onChatterClick && <span className="text-teal-400/50 ml-1">— click name for shift report</span>}
          </p>
        </div>
        <ExportButtons data={data} filename="chatter-rankings" />
      </div>

      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-white/30 text-sm">No chatter profiles yet</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={visible.length * 32}>
            <BarChart data={visible} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} width={100} />
              <Tooltip content={<GlassTooltip />} />
              <Bar dataKey="avgScore" name="Score" radius={[0, 6, 6, 0]} barSize={16}>
                {visible.map((entry, i) => <Cell key={i} fill={scoreColor(entry.avgScore)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {showToggle && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-white/40 hover:text-white/70 transition"
            >
              {expanded ? <><ChevronUp size={14} /> Show top {COLLAPSED_COUNT}</> : <><ChevronDown size={14} /> Show all {data.length} chatters</>}
            </button>
          )}

          {onChatterClick && (
            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="text-[10px] text-white/30 mb-2 flex items-center gap-1">
                <Shield size={10} className="text-teal-400" /> Click to open shift accountability report
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.map((c) => (
                  <button
                    key={c.email}
                    onClick={() => onChatterClick(c.email)}
                    className="glass-button rounded-xl px-3 py-1.5 text-[11px] text-white/60 hover:text-white hover:border-teal-500/30 transition-all flex items-center gap-1.5 group"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: scoreColor(c.avgScore) }} />
                    <span>{c.name}</span>
                    <span className="text-white/20 group-hover:text-teal-400/60 text-[9px]">{c.avgScore}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

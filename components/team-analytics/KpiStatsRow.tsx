"use client";

import { Users, Clock, BarChart3, Zap, Radio, Trophy } from "lucide-react";
import { scoreColor } from "./chart-colors";

type KpiData = {
  activeChatters: number;
  totalSessions: number;
  avgTeamScore: number;
  totalHoursWorked: number;
  scoringSessionsCount: number;
  liveNow: number;
};

const cards = [
  { key: "liveNow", label: "Live Now", icon: Radio, format: (v: number) => String(v) },
  { key: "activeChatters", label: "Active Chatters", icon: Users, format: (v: number) => String(v) },
  { key: "avgTeamScore", label: "Avg Score", icon: Trophy, format: (v: number) => String(v) },
  { key: "totalSessions", label: "Sessions", icon: Zap, format: (v: number) => String(v) },
  { key: "totalHoursWorked", label: "Hours Worked", icon: Clock, format: (v: number) => `${parseFloat(v.toFixed(1))}h` },
  { key: "scoringSessionsCount", label: "Scored", icon: BarChart3, format: (v: number) => String(v) },
] as const;

export function KpiStatsRow({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const value = data[card.key as keyof KpiData] as number;
        const Icon = card.icon;
        const isScore = card.key === "avgTeamScore";
        return (
          <div key={card.key} className="glass-card rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Icon size={16} className="text-white/30" />
              {card.key === "liveNow" && value > 0 && (
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              )}
            </div>
            <div className={`text-2xl font-bold tracking-tight ${isScore ? "" : "text-white"}`} style={isScore ? { color: scoreColor(value) } : undefined}>
              {card.format(value)}
            </div>
            <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}

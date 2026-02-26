"use client";

import { useState } from "react";
import { Keyboard, Mouse, Activity, Wifi, WifiOff, ChevronDown, Settings } from "lucide-react";
import Link from "next/link";

type LiveEntry = {
  email: string;
  name: string;
  creator: string;
  clockIn: string;
  source: string;
  keyboardPct: number | null;
  mousePct: number | null;
  overallActivity: number | null;
  activityUpdatedAt: string | null;
};

type AvgActivity = {
  keyboard: number;
  mouse: number;
  overall: number;
  sessionCount: number;
} | null;

function ActivityBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-16 glass-inset rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
    </div>
  );
}

function activityColor(pct: number): string {
  if (pct >= 60) return "#34d399"; // green — active
  if (pct >= 30) return "#fbbf24"; // amber — low
  return "#f87171"; // red — idle
}

function duration(clockIn: string): string {
  const diff = Date.now() - new Date(clockIn).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just started";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}h ${m}m`;
}

export function LiveActivityPanel({ data, avgActivity }: { data: LiveEntry[]; avgActivity: AvgActivity }) {
  const [expanded, setExpanded] = useState(data.length > 0);
  const isEmpty = data.length === 0;

  // Collapsed / empty state — single compact row
  if (isEmpty && !expanded) {
    return (
      <div className="glass-card rounded-3xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WifiOff size={14} className="text-white/20" />
          <span className="text-white/40 text-xs font-medium">Live Activity</span>
          <span className="text-white/20 text-[10px]">No chatters online right now</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/team/hubstaff" className="glass-button rounded-lg px-2.5 py-1 text-[10px] text-white/30 hover:text-white flex items-center gap-1">
            <Settings size={10} /> Hubstaff Setup
          </Link>
          <button onClick={() => setExpanded(true)} className="text-white/20 hover:text-white/40">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${data.length > 0 ? "bg-teal-400 animate-pulse" : "bg-white/20"}`} />
              Live Activity
              {data.length > 0 && <span className="text-teal-400/60 text-[10px] font-normal">{data.length} online</span>}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              Real-time Hubstaff data — keyboard, mouse, and overall activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {avgActivity && (
            <div className="text-right mr-2">
              <div className="text-[10px] text-white/30">Period avg</div>
              <div className="text-sm font-bold tabular-nums" style={{ color: activityColor(avgActivity.overall) }}>
                {avgActivity.overall}%
              </div>
            </div>
          )}
          <Link href="/team/hubstaff" className="glass-button rounded-lg px-2.5 py-1 text-[10px] text-white/30 hover:text-white flex items-center gap-1">
            <Settings size={10} /> Setup
          </Link>
          <button onClick={() => setExpanded(!expanded)} className="text-white/20 hover:text-white/40">
            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center text-white/20 text-xs py-4 gap-2">
          <WifiOff size={14} />
          <span>No chatters online. <Link href="/team/hubstaff" className="text-teal-400/50 hover:text-teal-400 underline">Connect Hubstaff</Link> to see live activity.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_60px_60px_60px_50px] gap-2 text-[10px] text-white/30 px-1">
            <span>Chatter</span>
            <span>Creator</span>
            <span className="flex items-center gap-1"><Keyboard size={9} /> Keys</span>
            <span className="flex items-center gap-1"><Mouse size={9} /> Mouse</span>
            <span className="flex items-center gap-1"><Activity size={9} /> Overall</span>
            <span>Time</span>
          </div>

          {data.map(s => {
            const overall = s.overallActivity ?? 0;
            return (
              <div key={`${s.email}-${s.clockIn}`} className="grid grid-cols-[1fr_80px_60px_60px_60px_50px] gap-2 items-center glass-inset rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Wifi size={10} className="text-teal-400 shrink-0" />
                  <span className="text-white text-xs font-medium truncate">{s.name}</span>
                </div>
                <span className="text-white/40 text-[10px] truncate">{s.creator}</span>

                {/* Keyboard */}
                <div className="flex items-center gap-1.5">
                  {s.keyboardPct !== null ? (
                    <>
                      <ActivityBar value={s.keyboardPct} color={activityColor(s.keyboardPct)} />
                      <span className="text-[10px] tabular-nums" style={{ color: activityColor(s.keyboardPct) }}>{s.keyboardPct}%</span>
                    </>
                  ) : (
                    <span className="text-white/15 text-[10px]">--</span>
                  )}
                </div>

                {/* Mouse */}
                <div className="flex items-center gap-1.5">
                  {s.mousePct !== null ? (
                    <>
                      <ActivityBar value={s.mousePct} color={activityColor(s.mousePct)} />
                      <span className="text-[10px] tabular-nums" style={{ color: activityColor(s.mousePct) }}>{s.mousePct}%</span>
                    </>
                  ) : (
                    <span className="text-white/15 text-[10px]">--</span>
                  )}
                </div>

                {/* Overall */}
                <div className="flex items-center gap-1.5">
                  {s.overallActivity !== null ? (
                    <>
                      <ActivityBar value={s.overallActivity} color={activityColor(s.overallActivity)} />
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: activityColor(s.overallActivity) }}>{s.overallActivity}%</span>
                    </>
                  ) : (
                    <span className="text-white/15 text-[10px]">--</span>
                  )}
                </div>

                {/* Duration */}
                <span className="text-white/30 text-[10px] tabular-nums">{duration(s.clockIn)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

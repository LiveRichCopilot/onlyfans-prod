"use client";

import { Keyboard, Mouse, Activity, Wifi, WifiOff } from "lucide-react";

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
  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            Live Activity
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Real-time Hubstaff data — keyboard, mouse, and overall activity for chatters online right now
          </p>
        </div>
        {avgActivity && (
          <div className="text-right">
            <div className="text-[10px] text-white/30">Period avg</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: activityColor(avgActivity.overall) }}>
              {avgActivity.overall}%
            </div>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-[120px] flex flex-col items-center justify-center text-white/30 text-sm gap-2">
          <WifiOff size={20} />
          <span>No chatters online right now</span>
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

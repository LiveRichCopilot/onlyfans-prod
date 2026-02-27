"use client";

import { useState } from "react";
import { Keyboard, Mouse, Activity, Wifi, WifiOff, ChevronDown, Settings, Info } from "lucide-react";
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
  if (pct > 100) return "#f87171"; // red — suspicious
  if (pct >= 60) return "#6b7280"; // muted gray — active
  if (pct >= 30) return "#fbbf24"; // amber — low
  return "#f87171"; // red — idle
}

function activityLabel(pct: number): string {
  if (pct > 100) return "Suspicious";
  if (pct >= 60) return "Active";
  if (pct >= 30) return "Low";
  return "Idle";
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

/** Compute live avg from displayed data (ignores stale DB values) */
function computeLiveAvg(data: LiveEntry[]): { keyboard: number; mouse: number; overall: number } | null {
  // Deduplicate by email (same chatter may appear for multiple creators)
  const byEmail = new Map<string, LiveEntry>();
  for (const entry of data) {
    if (entry.overallActivity == null) continue;
    const existing = byEmail.get(entry.email);
    if (!existing) { byEmail.set(entry.email, entry); continue; }
    // Keep the one with the latest activityUpdatedAt
    if ((entry.activityUpdatedAt || "") > (existing.activityUpdatedAt || "")) {
      byEmail.set(entry.email, entry);
    }
  }
  const unique = [...byEmail.values()];
  if (unique.length === 0) return null;
  const avg = (arr: (number | null)[]) => {
    const vals = arr.filter((v): v is number => v != null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };
  return {
    keyboard: avg(unique.map(e => e.keyboardPct)),
    mouse: avg(unique.map(e => e.mousePct)),
    overall: avg(unique.map(e => e.overallActivity)),
  };
}

export function LiveActivityPanel({ data, avgActivity: _dbAvg }: { data: LiveEntry[]; avgActivity: AvgActivity }) {
  const [expanded, setExpanded] = useState(data.length > 0);
  const [showGuide, setShowGuide] = useState(false);
  const isEmpty = data.length === 0;

  // Use live-computed avg (not stale DB values)
  const liveAvg = computeLiveAvg(data);

  // Collapsed / empty state
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
      {/* Header — always visible */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${data.length > 0 ? "bg-teal-400 animate-pulse" : "bg-white/20"}`} />
              Live Activity
              {data.length > 0 && <span className="text-teal-400/60 text-[10px] font-normal">{data.length} online</span>}
            </h3>
            {expanded && (
              <p className="text-white/40 text-xs mt-0.5">
                How much of their tracked time each chatter is actually using keyboard and mouse
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liveAvg && (
            <div className="text-right mr-2">
              <div className="text-[10px] text-white/30">Team avg</div>
              <div className="text-sm font-bold tabular-nums" style={{ color: activityColor(liveAvg.overall) }}>
                {liveAvg.overall}%
              </div>
            </div>
          )}
          <Link href="/team/hubstaff" className="glass-button rounded-lg px-2.5 py-1 text-[10px] text-white/30 hover:text-white flex items-center gap-1">
            <Settings size={10} /> Setup
          </Link>
          {expanded && (
            <button onClick={() => setShowGuide(!showGuide)} className="text-white/20 hover:text-white/40" title="What do these numbers mean?">
              <Info size={14} />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-white/20 hover:text-white/40">
            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Everything below collapses */}
      {expanded && (
        <>
          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#6b7280" }} />
              <span className="text-white/40 text-[10px]"><span className="text-white/60 font-medium">60%+</span> Active — working normally</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24" }} />
              <span className="text-white/40 text-[10px]"><span className="text-white/60 font-medium">30-59%</span> Low — some activity but below average</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f87171" }} />
              <span className="text-white/40 text-[10px]"><span className="text-white/60 font-medium">&lt;30%</span> Idle — barely touching keyboard/mouse</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border border-red-400/50" style={{ background: "#f87171" }} />
              <span className="text-white/40 text-[10px]"><span className="text-white/60 font-medium">&gt;100%</span> Suspicious — possible mouse jiggler</span>
            </div>
          </div>

          {/* Expandable Guide — detailed explanation */}
          {showGuide && (
            <div className="glass-inset rounded-xl px-4 py-3 mb-3 text-[11px] leading-relaxed text-white/50 space-y-2">
              <p className="text-white/70 font-medium">What does Activity % mean?</p>
              <p>
                Activity % shows how much of the tracked time Hubstaff detected keyboard or mouse input.
                If a chatter has been clocked in for 30 minutes and used their keyboard/mouse for 15 of those minutes,
                their overall activity is <span className="text-white/70 font-medium">50%</span>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
                <div>
                  <span className="font-medium" style={{ color: "#6b7280" }}>Gray (60%+) = Active</span>
                  <span className="text-white/40"> — Working normally. Typing and clicking at a healthy pace.</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "#fbbf24" }}>Amber (30-59%) = Low</span>
                  <span className="text-white/40"> — Below average. Could be reading, thinking, or distracted.</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "#f87171" }}>Red (&lt;30%) = Idle</span>
                  <span className="text-white/40"> — Barely using keyboard or mouse. AFK, on phone, or off-task.</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "#f87171" }}>Red (&gt;100%) = Suspicious</span>
                  <span className="text-white/40"> — More input than humanly possible. Mouse jiggler or auto-clicker.</span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-white/5 text-white/30">
                <p><span className="text-white/50 font-medium">Keys</span> = keyboard input only. <span className="text-white/50 font-medium">Mouse</span> = mouse/trackpad only. <span className="text-white/50 font-medium">Overall</span> = any input combined.</p>
                <p className="mt-1">Industry average for active chatters: <span className="text-white/50">40-70%</span>. Nobody types 100% of the time — reading and thinking are normal.</p>
              </div>
            </div>
          )}

          {isEmpty ? (
            <div className="flex items-center justify-center text-white/20 text-xs py-4 gap-2">
              <WifiOff size={14} />
              <span>No chatters online. <Link href="/team/hubstaff" className="text-teal-400/50 hover:text-teal-400 underline">Connect Hubstaff</Link> to see live activity.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Column Header */}
              <div className="grid grid-cols-[1fr_80px_60px_60px_60px_50px] gap-2 text-[10px] text-white/30 px-1">
                <span>Chatter</span>
                <span>Creator</span>
                <span className="flex items-center gap-1"><Keyboard size={9} /> Keys</span>
                <span className="flex items-center gap-1"><Mouse size={9} /> Mouse</span>
                <span className="flex items-center gap-1"><Activity size={9} /> Overall</span>
                <span>Time</span>
              </div>

              {data.map(s => (
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
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

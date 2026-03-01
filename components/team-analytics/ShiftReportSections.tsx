"use client";

import { Clock, AppWindow } from "lucide-react";

type HourlyEntry = {
  windowStart: string;
  windowEnd: string;
  totalScore: number;
  messagesAnalyzed: number;
  conversationsScanned: number;
  archetype: string | null;
  aiNotes: string | null;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function activityColor(pct: number): string {
  if (pct >= 60) return "#34d399";
  if (pct >= 30) return "#fbbf24";
  return "#f87171";
}

/** Hourly performance timeline */
export function HourlyTimeline({ timeline }: { timeline: HourlyEntry[] }) {
  if (timeline.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <Clock size={12} className="text-teal-400" /> Hourly Performance
      </h4>
      <div className="space-y-1.5">
        {timeline.map((h, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <span className="text-[10px] text-white/60 w-14 shrink-0 tabular-nums">
              {formatTime(h.windowStart)}
            </span>
            <div className="flex-1 h-5 glass-inset rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg transition-all"
                style={{ width: `${h.totalScore}%`, background: activityColor(h.totalScore) }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80">
                {h.totalScore}
              </span>
            </div>
            <span className="text-[9px] text-white/50 w-12 shrink-0 text-right">{h.messagesAnalyzed} msgs</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Top apps used during shift */
export function TopAppsSection({ apps }: { apps: { name: string; seconds: number; pct: number }[] }) {
  if (apps.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <AppWindow size={12} className="text-teal-400" /> Top Apps During Shift
      </h4>
      <div className="space-y-1.5">
        {apps.map((app, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-white/80 w-28 truncate">{app.name}</span>
            <div className="flex-1 h-1.5 glass-inset rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-teal-400/60" style={{ width: `${app.pct}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-white/70 w-10 text-right">{app.pct}%</span>
            <span className="text-[10px] tabular-nums text-white/50 w-12 text-right">{formatSeconds(app.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Strength and mistake tags */
export function TagsSection({ strengths, mistakes }: { strengths: string[]; mistakes: string[] }) {
  if (strengths.length === 0 && mistakes.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold">Tags</h4>
      {strengths.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {strengths.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-teal-500/15 text-teal-400 border border-teal-500/20">
              {t}
            </span>
          ))}
        </div>
      )}
      {mistakes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mistakes.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

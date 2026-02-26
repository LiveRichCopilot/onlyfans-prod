"use client";

import { useState, useEffect } from "react";
import {
  X, RefreshCw, MessageSquare, Users, Clock, Zap,
  Keyboard, Mouse, Activity, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Copy, Shield, AppWindow,
} from "lucide-react";

type ShiftReportData = {
  email: string;
  name: string;
  date: string;
  shift: string | null;
  sessionCount: number;
  firstClockIn: string | null;
  lastClockOut: string | null;
  totalShiftDurationHrs: number;
  scoringWindows: number;
  avgScore: number;
  scoreBreakdown: { sla: number; followup: number; trigger: number; quality: number; revenue: number };
  totalMessages: number;
  totalConversations: number;
  totalBlasts: number;
  penalties: { copyPaste: number; missedTrigger: number; spam: number };
  strengthTags: string[];
  mistakeTags: string[];
  hourlyTimeline: { windowStart: string; windowEnd: string; totalScore: number; messagesAnalyzed: number; conversationsScanned: number; archetype: string | null; aiNotes: string | null }[];
  dominantArchetype: string | null;
  hubstaff: { keyboard: number; mouse: number; overall: number; totalTrackedSeconds: number; totalTrackedHrs: number } | null;
  topApps: { name: string; seconds: number; pct: number }[];
  messagesPerHour: number;
  revenuePerHour: number;
  idleTimeHrs: number;
  activityVerdict: "excellent" | "good" | "low" | "critical" | "no_data";
  effortVerdict: "high" | "moderate" | "low" | "idle";
};

type Props = {
  email: string;
  creatorId?: string;
  date?: string;
  onClose: () => void;
};

function activityColor(pct: number): string {
  if (pct >= 60) return "#34d399";
  if (pct >= 30) return "#fbbf24";
  return "#f87171";
}

function verdictConfig(v: string): { label: string; color: string; icon: typeof CheckCircle } {
  switch (v) {
    case "excellent": return { label: "Excellent", color: "#34d399", icon: CheckCircle };
    case "good": return { label: "Good", color: "#2dd4bf", icon: CheckCircle };
    case "high": return { label: "High Effort", color: "#34d399", icon: TrendingUp };
    case "moderate": return { label: "Moderate", color: "#fbbf24", icon: TrendingUp };
    case "low": return { label: "Low", color: "#f87171", icon: TrendingDown };
    case "critical": return { label: "Critical", color: "#ef4444", icon: AlertTriangle };
    case "idle": return { label: "Idle", color: "#ef4444", icon: AlertTriangle };
    default: return { label: "No Data", color: "#666", icon: Activity };
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function ActivityBar({ value, label, icon: Icon }: { value: number; label: string; icon: typeof Keyboard }) {
  const color = activityColor(value);
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-white/40 shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-white/50">{label}</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{value}%</span>
        </div>
        <div className="h-2 glass-inset rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, value)}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 glass-inset rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] tabular-nums font-medium w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export function ShiftReportPanel({ email, creatorId, date, onClose }: Props) {
  const [data, setData] = useState<ShiftReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ email });
        if (creatorId) params.set("creatorId", creatorId);
        if (date) params.set("date", date);
        const res = await fetch(`/api/team-analytics/shift-report?${params}`);
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        setData(await res.json());
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, [email, creatorId, date]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 glass-prominent rounded-t-3xl px-6 py-4 flex items-center justify-between border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <Shield size={16} className="text-teal-400" />
              Shift Report
            </h2>
            <p className="text-white/40 text-xs mt-0.5">
              {loading ? "Loading..." : data ? `${data.name} - ${data.date}` : "Error"}
            </p>
          </div>
          <button onClick={onClose} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-teal-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-400 text-sm">{error}</div>
        ) : data ? (
          <div className="p-6 space-y-5">
            <ShiftSummaryRow data={data} />
            <HubstaffSection data={data} />
            <ScoringSection data={data} />
            <TopAppsSection apps={data.topApps} />
            <HourlyTimeline timeline={data.hourlyTimeline} />
            <TagsSection strengths={data.strengthTags} mistakes={data.mistakeTags} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Top row: KPI pills */
function ShiftSummaryRow({ data }: { data: ShiftReportData }) {
  const effort = verdictConfig(data.effortVerdict);
  const activity = verdictConfig(data.activityVerdict);

  return (
    <div className="space-y-3">
      {/* Verdict banner */}
      <div className="glass-inset rounded-2xl p-4 flex items-center gap-4">
        <div className="flex-1 space-y-1">
          <div className="text-[11px] text-white/40">Activity Verdict</div>
          <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: activity.color }}>
            <activity.icon size={14} /> {activity.label}
          </div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex-1 space-y-1">
          <div className="text-[11px] text-white/40">Effort Verdict</div>
          <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: effort.color }}>
            <effort.icon size={14} /> {effort.label}
          </div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex-1 space-y-1">
          <div className="text-[11px] text-white/40">Avg Score</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: activityColor(data.avgScore) }}>
            {data.avgScore}/100
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill icon={MessageSquare} label="Messages" value={String(data.totalMessages)} sub={`${data.messagesPerHour}/hr`} />
        <StatPill icon={Users} label="Fans Reached" value={String(data.totalConversations)} />
        <StatPill icon={Clock} label="Shift Duration" value={`${data.totalShiftDurationHrs}h`} sub={data.firstClockIn ? formatTime(data.firstClockIn) : "--"} />
        <StatPill icon={Zap} label="Idle Time" value={`${data.idleTimeHrs}h`} warn={data.idleTimeHrs > 1} />
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, sub, warn }: { icon: typeof Clock; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="glass-inset rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-white/30" />
        <span className="text-[10px] text-white/40">{label}</span>
      </div>
      <div className={`text-sm font-bold tabular-nums ${warn ? "text-red-400" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[10px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

/** Hubstaff activity bars */
function HubstaffSection({ data }: { data: ShiftReportData }) {
  if (!data.hubstaff) {
    return (
      <div className="glass-inset rounded-2xl p-4 text-center">
        <Activity size={18} className="text-white/20 mx-auto mb-2" />
        <p className="text-white/30 text-xs">No Hubstaff data for this date</p>
        <p className="text-white/15 text-[10px] mt-1">Chatter may not be mapped in Hubstaff</p>
      </div>
    );
  }

  const hs = data.hubstaff;
  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
          <Activity size={12} className="text-teal-400" /> Hubstaff Activity
        </h4>
        <span className="text-[10px] text-white/30">Tracked: {hs.totalTrackedHrs}h of {data.totalShiftDurationHrs}h shift</span>
      </div>
      <div className="space-y-2.5">
        <ActivityBar value={hs.keyboard} label="Keyboard" icon={Keyboard} />
        <ActivityBar value={hs.mouse} label="Mouse" icon={Mouse} />
        <ActivityBar value={hs.overall} label="Overall" icon={Activity} />
      </div>
    </div>
  );
}

/** Score breakdown */
function ScoringSection({ data }: { data: ShiftReportData }) {
  const { scoreBreakdown: s, penalties: p, totalBlasts } = data;
  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <TrendingUp size={12} className="text-teal-400" /> Score Breakdown
      </h4>
      <div className="space-y-2">
        <ScoreBar label="SLA" value={s.sla} max={25} color="#60a5fa" />
        <ScoreBar label="Follow-up" value={s.followup} max={20} color="#2dd4bf" />
        <ScoreBar label="Triggers" value={s.trigger} max={20} color="#a78bfa" />
        <ScoreBar label="Quality" value={s.quality} max={20} color="#fbbf24" />
        <ScoreBar label="Revenue" value={s.revenue} max={15} color="#34d399" />
      </div>
      {(p.copyPaste !== 0 || p.missedTrigger !== 0 || p.spam !== 0 || totalBlasts > 0) && (
        <div className="border-t border-white/5 pt-2 space-y-1">
          {p.copyPaste !== 0 && (
            <div className="flex items-center gap-2 text-red-400 text-[11px]">
              <Copy size={10} /> Copy-paste penalty: {p.copyPaste}pts
            </div>
          )}
          {p.missedTrigger !== 0 && (
            <div className="flex items-center gap-2 text-red-400 text-[11px]">
              <AlertTriangle size={10} /> Missed trigger: {p.missedTrigger}pts
            </div>
          )}
          {p.spam !== 0 && (
            <div className="flex items-center gap-2 text-red-400 text-[11px]">
              <AlertTriangle size={10} /> Spam penalty: {p.spam}pts
            </div>
          )}
          {totalBlasts > 0 && (
            <div className="flex items-center gap-2 text-amber-400 text-[11px]">
              <Copy size={10} /> Copy-paste blasts detected: {totalBlasts}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Top apps used during shift */
function TopAppsSection({ apps }: { apps: ShiftReportData["topApps"] }) {
  if (apps.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <AppWindow size={12} className="text-teal-400" /> Top Apps During Shift
      </h4>
      <div className="space-y-1.5">
        {apps.map((app, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-white/60 w-28 truncate">{app.name}</span>
            <div className="flex-1 h-1.5 glass-inset rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-teal-400/60" style={{ width: `${app.pct}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-white/40 w-10 text-right">{app.pct}%</span>
            <span className="text-[10px] tabular-nums text-white/20 w-12 text-right">{formatSeconds(app.seconds)}</span>
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

/** Hourly performance timeline */
function HourlyTimeline({ timeline }: { timeline: ShiftReportData["hourlyTimeline"] }) {
  if (timeline.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <Clock size={12} className="text-teal-400" /> Hourly Performance
      </h4>
      <div className="space-y-1.5">
        {timeline.map((h, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <span className="text-[10px] text-white/30 w-14 shrink-0 tabular-nums">
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
            <span className="text-[9px] text-white/20 w-12 shrink-0 text-right">{h.messagesAnalyzed} msgs</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Strength and mistake tags */
function TagsSection({ strengths, mistakes }: { strengths: string[]; mistakes: string[] }) {
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

"use client";

import { useState, useEffect } from "react";
import {
  X, RefreshCw, MessageSquare, Users, Clock, Zap,
  Keyboard, Mouse, Activity, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Copy, Shield,
} from "lucide-react";
import { ScreenshotTimeline } from "./ScreenshotTimeline";
import { HourlyTimeline, TagsSection, TopAppsSection } from "./ShiftReportSections";

type ShiftReportData = {
  email: string;
  name: string;
  creatorName: string | null;
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
  hourlyTimeline: {
    windowStart: string; windowEnd: string; totalScore: number;
    messagesAnalyzed: number; conversationsScanned: number;
    archetype: string | null; aiNotes: string | null;
    notableQuotes?: any[] | null; conversationData?: any;
    scores?: { sla: number; followup: number; trigger: number; quality: number; revenue: number };
    strengthTags?: string[]; mistakeTags?: string[];
  }[];
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

/** Hubstaff activity % = how much of tracked time had keyboard/mouse input.
 *  Over 100% is suspicious (possible mouse jiggler or auto-clicker). */
function activityVerdict(pct: number): { label: string; color: string } {
  if (pct > 100) return { label: "Suspicious — possible auto-clicker", color: "#f87171" };
  if (pct >= 60) return { label: "Normal", color: "#9ca3af" };
  if (pct >= 30) return { label: "Low activity", color: "#fbbf24" };
  return { label: "Very low", color: "#f87171" };
}

function hubstaffActivityColor(pct: number): string {
  if (pct > 100) return "#f87171"; // Suspicious — over 100% is not normal
  if (pct >= 60) return "#6b7280"; // muted gray — normal, no need to highlight
  if (pct >= 30) return "#fbbf24"; // amber — low
  return "#f87171"; // red — very low
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
  const color = hubstaffActivityColor(value);
  const verdict = activityVerdict(value);
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-white/50 shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-white/90 font-medium">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: verdict.color }}>{verdict.label}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}%</span>
          </div>
        </div>
        <div className="h-3 glass-inset rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, value)}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max, color, tooltip }: { label: string; value: number; max: number; color: string; tooltip?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group relative">
      <span className="text-sm text-white/90 w-20 shrink-0 font-medium">{label}</span>
      <div className="flex-1 h-2.5 glass-inset rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm tabular-nums font-bold w-14 text-right" style={{ color }}>{value}/{max}</span>
      {tooltip && (
        <div className="absolute left-0 -top-8 hidden group-hover:block bg-[#12141a]/95 backdrop-blur-xl border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80 whitespace-nowrap z-10 shadow-lg">
          {tooltip}
        </div>
      )}
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
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Shield size={18} className="text-teal-400" />
              Shift Report
            </h2>
            <p className="text-white/70 text-sm mt-0.5">
              {loading ? "Loading..." : data ? (
                <>
                  <span className="font-semibold text-white">{data.name}</span>
                  {data.creatorName && <span className="text-teal-400/80"> on {data.creatorName}</span>}
                  <span className="text-white/50"> — {data.date}</span>
                </>
              ) : "Error"}
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
            <ScreenshotTimeline email={email} date={data.date} />
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
      <div className="glass-inset rounded-2xl p-5 flex items-center gap-4">
        <div className="flex-1 space-y-1">
          <div className="text-xs text-white/70 font-medium">Activity Verdict</div>
          <div className="text-base font-bold flex items-center gap-1.5" style={{ color: activity.color }}>
            <activity.icon size={16} /> {activity.label}
          </div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div className="flex-1 space-y-1">
          <div className="text-xs text-white/70 font-medium">Effort Verdict</div>
          <div className="text-base font-bold flex items-center gap-1.5" style={{ color: effort.color }}>
            <effort.icon size={16} /> {effort.label}
          </div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div className="flex-1 space-y-1">
          <div className="text-xs text-white/70 font-medium">Avg Score</div>
          <div className="text-base font-bold tabular-nums" style={{ color: activityColor(data.avgScore) }}>
            {data.avgScore}/100
          </div>
        </div>
      </div>

      {/* Diagnostic — explain WHY data is missing */}
      {(data.activityVerdict === "no_data" || data.effortVerdict === "idle" || (data.scoringWindows === 0 && data.totalMessages === 0)) && (
        <div className="glass-inset rounded-xl px-4 py-3 space-y-1.5 border border-amber-500/15">
          <div className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold">
            <AlertTriangle size={12} /> Why is this report empty?
          </div>
          {!data.hubstaff && data.sessionCount === 0 && (
            <p className="text-sm text-white/70 leading-relaxed">
              Chatter not linked to Hubstaff and no clock-in sessions recorded for this date. They may not have worked this shift.
            </p>
          )}
          {!data.hubstaff && data.sessionCount > 0 && (
            <p className="text-sm text-white/70 leading-relaxed">
              No Hubstaff tracking. Chatter has {data.sessionCount} session{data.sessionCount !== 1 ? "s" : ""} but no activity data was recorded — check Hubstaff mapping.
            </p>
          )}
          {data.hubstaff && data.scoringWindows === 0 && (
            <p className="text-sm text-white/70 leading-relaxed">
              Tracked by Hubstaff ({data.hubstaff.totalTrackedHrs}h) but no conversations were scored — chatter may not be assigned to a creator, or no messages were sent.
            </p>
          )}
          {data.totalMessages === 0 && data.scoringWindows > 0 && (
            <p className="text-sm text-white/70 leading-relaxed">
              No messages sent during this shift. Scoring windows exist but message count is zero — possible data sync delay.
            </p>
          )}
          {data.hubstaff && data.hubstaff.overall < 10 && data.hubstaff.totalTrackedHrs > 0 && (
            <p className="text-sm text-white/70 leading-relaxed">
              Hubstaff shows {data.hubstaff.totalTrackedHrs}h tracked but only {data.hubstaff.overall}% activity — chatter may have left tracking running while away.
            </p>
          )}
        </div>
      )}

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
    <div className="glass-inset rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={14} className="text-white/60" />
        <span className="text-xs text-white/70 font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold tabular-nums ${warn ? "text-red-400" : "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-white/60 mt-0.5">{sub}</div>}
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
  const isSuspicious = hs.keyboard > 100 || hs.mouse > 100 || hs.overall > 100;
  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white/90 text-sm font-bold flex items-center gap-1.5">
          <Activity size={14} className="text-teal-400" /> Hubstaff Activity
        </h4>
        <span className="text-xs text-white/70">Tracked: {hs.totalTrackedHrs}h of {data.totalShiftDurationHrs}h shift</span>
      </div>
      {/* Explanation */}
      <div className="text-xs text-white/60 leading-relaxed">
        % of tracked time with keyboard/mouse input. 60%+ = active, 30-60% = low, under 30% = very low.
        {isSuspicious && (
          <span className="text-red-400 font-medium ml-1">
            Over 100% = possible mouse jiggler or auto-clicker software.
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        <ActivityBar value={hs.keyboard} label="Keyboard" icon={Keyboard} />
        <ActivityBar value={hs.mouse} label="Mouse" icon={Mouse} />
        <ActivityBar value={hs.overall} label="Overall" icon={Activity} />
      </div>
      {isSuspicious && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertTriangle size={12} />
          Activity over 100% is not possible with normal use. This chatter may be using software to fake activity.
        </div>
      )}
    </div>
  );
}

/** Score breakdown */
function ScoringSection({ data }: { data: ShiftReportData }) {
  const { scoreBreakdown: s, penalties: p, totalBlasts } = data;
  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/90 text-sm font-bold flex items-center gap-1.5">
        <TrendingUp size={14} className="text-teal-400" /> Score Breakdown
      </h4>
      <div className="space-y-2">
        <ScoreBar label="SLA" value={s.sla} max={25} color="#60a5fa" tooltip="Response speed. 25 = under 5 min replies" />
        <ScoreBar label="Follow-up" value={s.followup} max={20} color="#2dd4bf" tooltip="Re-engaging quiet fans. 20 = always follows up" />
        <ScoreBar label="Triggers" value={s.trigger} max={20} color="#a78bfa" tooltip="Acting on buying signals. 20 = never misses" />
        <ScoreBar label="Quality" value={s.quality} max={20} color="#fbbf24" tooltip="Creative, personal messages. 20 = excellent" />
        <ScoreBar label="Revenue" value={s.revenue} max={15} color="#34d399" tooltip="Closed sales (PPV, tips). 15 = strong closer" />
      </div>
      {(p.copyPaste !== 0 || p.missedTrigger !== 0 || p.spam !== 0 || totalBlasts > 0) && (
        <div className="border-t border-white/5 pt-2 space-y-1">
          {p.copyPaste !== 0 && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <Copy size={10} /> Copy-paste penalty: {p.copyPaste}pts
            </div>
          )}
          {p.missedTrigger !== 0 && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle size={10} /> Missed trigger: {p.missedTrigger}pts
            </div>
          )}
          {p.spam !== 0 && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle size={10} /> Spam penalty: {p.spam}pts
            </div>
          )}
          {totalBlasts > 0 && (
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <Copy size={10} /> Copy-paste blasts detected: {totalBlasts}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



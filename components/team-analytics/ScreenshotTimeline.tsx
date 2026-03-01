"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, Eye, AlertTriangle, Scan, ChevronLeft, ChevronRight } from "lucide-react";
import { ExpandedScreenshot } from "./ExpandedScreenshot";

type Screenshot = {
  id: number;
  url: string;
  thumb_url?: string;
  recorded_at: string;
  user_id: number;
};

type Analysis = {
  screenshotId: number;
  timestamp: string;
  app: string;
  activity: "chatting" | "browsing" | "idle" | "social_media" | "video" | "other";
  onOnlyFans: boolean;
  description: string;
  reason: string;
  flagged: boolean;
  analysisFailed: boolean;
};

type Summary = {
  totalScreenshots: number;
  analyzedCount: number;
  onOfPct: number;
  flaggedCount: number;
  sameScreenStreak: number;
};

type Props = {
  email: string;
  date?: string;
};

/** Hubstaff screenshots are pre-signed S3 URLs — load directly, no proxy needed. */
function screenshotUrl(url: string): string {
  return url;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function borderColor(analysis: Analysis | undefined): string {
  if (!analysis) return "border-white/10";
  if (analysis.analysisFailed) return "border-white/20";
  if (analysis.flagged) return "border-red-500/70";
  if (analysis.onOnlyFans && analysis.activity === "chatting") return "border-emerald-500/70";
  if (analysis.onOnlyFans) return "border-amber-500/70";
  return "border-red-500/70";
}

function activityLabel(analysis: Analysis): string {
  const labels: Record<string, string> = {
    chatting: "Chatting",
    browsing: "Browsing",
    idle: "Idle",
    social_media: "Social Media",
    video: "Video",
    other: "Other",
  };
  return labels[analysis.activity] || "Other";
}

function activityLabelColor(analysis: Analysis): string {
  if (analysis.analysisFailed) return "text-white/25";
  if (analysis.onOnlyFans && analysis.activity === "chatting") return "text-emerald-400";
  if (analysis.onOnlyFans) return "text-amber-400";
  if (analysis.flagged) return "text-red-400";
  return "text-white/50";
}

export function ScreenshotTimeline({ email, date }: Props) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [analysisMap, setAnalysisMap] = useState<Map<number, Analysis>>(new Map());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<Screenshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  const fetchScreenshots = useCallback(
    async (withAnalysis: boolean) => {
      if (withAnalysis) setAnalyzing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ email });
        if (date) params.set("date", date);
        if (withAnalysis) params.set("analyze", "true");

        const res = await fetch(`/api/team-analytics/screenshots?${params}`);
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();

        if (data.error && data.screenshots?.length === 0) {
          setError(data.error);
        }

        setScreenshots(data.screenshots || []);
        setSummary(data.summary || null);

        if (data.analysis) {
          const map = new Map<number, Analysis>();
          for (const a of data.analysis) {
            map.set(a.screenshotId, a);
          }
          setAnalysisMap(map);
        }
      } catch (e: any) {
        setError(e.message);
      }

      setLoading(false);
      setAnalyzing(false);
    },
    [email, date]
  );

  useEffect(() => {
    fetchScreenshots(false);
  }, [fetchScreenshots]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -360 : 360;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Sync label scroll with thumbnail scroll
  const handleThumbScroll = useCallback(() => {
    if (scrollRef.current && labelsRef.current) {
      labelsRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, []);

  if (loading) {
    return (
      <div className="glass-inset rounded-2xl p-4">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Camera size={14} className="animate-pulse" />
          Loading screenshots...
        </div>
      </div>
    );
  }

  if (error && screenshots.length === 0) {
    return (
      <div className="glass-inset rounded-2xl p-4 text-center">
        <Camera size={18} className="text-white/20 mx-auto mb-2" />
        <p className="text-white/30 text-xs">{error}</p>
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <div className="glass-inset rounded-2xl p-4 text-center">
        <Camera size={18} className="text-white/20 mx-auto mb-2" />
        <p className="text-white/30 text-xs">No screenshots for this date</p>
      </div>
    );
  }

  const analyzed = analysisMap.size > 0;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
          <Camera size={12} className="text-teal-400" />
          Screenshot Timeline
          <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-white/40 tabular-nums">
            {screenshots.length}
          </span>
        </h4>
        <div className="flex items-center gap-2">
          {!analyzed && (
            <button
              onClick={() => fetchScreenshots(true)}
              disabled={analyzing}
              className="glass-button rounded-lg px-3 py-1.5 text-[11px] font-medium text-teal-400 flex items-center gap-1.5 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Scan size={11} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Eye size={11} />
                  Analyze with AI
                </>
              )}
            </button>
          )}
          {analyzed && (
            <span className="text-[10px] text-teal-400/60 flex items-center gap-1">
              <Scan size={10} />
              AI analyzed
            </span>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {analyzed && summary && (() => {
        // Compute activity breakdown from analysisMap
        const counts: Record<string, number> = {};
        let failedCount = 0;
        for (const a of analysisMap.values()) {
          if (a.analysisFailed) { failedCount++; continue; }
          counts[a.activity] = (counts[a.activity] || 0) + 1;
        }
        const total = analysisMap.size;
        const activityPills: { label: string; count: number; color: string }[] = [
          { label: "Chatting", count: counts.chatting || 0, color: "#34d399" },
          { label: "Browsing", count: counts.browsing || 0, color: "#fbbf24" },
          { label: "Idle", count: counts.idle || 0, color: "#f87171" },
          { label: "Social Media", count: counts.social_media || 0, color: "#a78bfa" },
          { label: "Video", count: counts.video || 0, color: "#60a5fa" },
          { label: "Other", count: counts.other || 0, color: "rgba(255,255,255,0.3)" },
        ].filter(p => p.count > 0);

        return (
          <div className="space-y-2">
            {/* Stats row */}
            <div className="flex items-center gap-3 text-[11px] flex-wrap">
              <span className="text-white/60">
                <span className="font-bold text-white tabular-nums">{summary.analyzedCount}</span> of {summary.totalScreenshots} analyzed
              </span>
              <span className="text-white/10">|</span>
              <span className="text-white/60">
                <span className="font-bold text-white tabular-nums">{summary.onOfPct}%</span> on OnlyFans
              </span>
              <span className="text-white/10">|</span>
              {summary.flaggedCount > 0 ? (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  {summary.flaggedCount} flagged
                </span>
              ) : (
                <span className="text-emerald-400">0 flagged</span>
              )}
              {summary.sameScreenStreak > 0 && (
                <>
                  <span className="text-white/10">|</span>
                  <span className="text-amber-400">
                    Stale screen: ~{summary.sameScreenStreak * 10} min
                  </span>
                </>
              )}
            </div>

            {/* Activity breakdown pills */}
            {activityPills.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {activityPills.map(p => (
                  <span key={p.label} className="text-[10px] font-medium px-2 py-0.5 rounded-lg border"
                    style={{ color: p.color, borderColor: p.color, background: `${typeof p.color === "string" && p.color.startsWith("#") ? p.color : "rgba(255,255,255,0.1)"}15` }}>
                    {p.label}: {p.count}
                  </span>
                ))}
                {failedCount > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg border border-white/10 text-white/30 bg-white/5">
                    Failed: {failedCount}
                  </span>
                )}
              </div>
            )}

            {/* Color legend explanation */}
            <div className="text-[10px] text-white/35 leading-relaxed">
              <span className="text-emerald-400/60">Green border</span> = chatting on OF.{" "}
              <span className="text-amber-400/60">Amber</span> = on OF but not chatting.{" "}
              <span className="text-red-400/60">Red / Flagged</span> = off-platform or idle.
            </div>
          </div>
        );
      })()}

      {/* Scrollable thumbnail strip */}
      <div className="relative group">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 glass-button rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft size={14} className="text-white/60" />
        </button>
        <div
          ref={scrollRef}
          onScroll={handleThumbScroll}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {screenshots.map((ss) => {
            const analysis = analysisMap.get(ss.id);
            return (
              <button
                key={ss.id}
                onClick={() => setExpanded(ss)}
                className={`shrink-0 rounded-xl border-2 overflow-hidden transition-all hover:scale-105 ${borderColor(analysis)}`}
                style={{ width: 120, height: 75 }}
              >
                <img
                  src={screenshotUrl(ss.thumb_url || ss.url)}
                  alt={`Screenshot ${formatTimestamp(ss.recorded_at)}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 glass-button rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight size={14} className="text-white/60" />
        </button>
      </div>

      {/* Timestamp labels row — synced with thumbnail scroll */}
      <div ref={labelsRef} className="flex gap-2.5 overflow-x-auto scrollbar-hide px-1" style={{ scrollbarWidth: "none" }}>
        {screenshots.map((ss) => {
          const analysis = analysisMap.get(ss.id);
          return (
            <div key={ss.id} className="shrink-0 text-center" style={{ width: 120 }}>
              <div className="text-[9px] text-white/30 tabular-nums">
                {formatTimestamp(ss.recorded_at)}
              </div>
              {analysis && (
                <div className={`text-[9px] font-medium truncate ${activityLabelColor(analysis)}`}>
                  {activityLabel(analysis)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded screenshot modal */}
      {expanded && (
        <ExpandedScreenshot
          screenshot={expanded}
          analysis={analysisMap.get(expanded.id)}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}


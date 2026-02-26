"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, Eye, AlertTriangle, Monitor, Scan, X, ChevronLeft, ChevronRight } from "lucide-react";

type Screenshot = {
  id: number;
  url: string;
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
  flagged: boolean;
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

function proxyUrl(url: string): string {
  return `/api/proxy-media?url=${encodeURIComponent(url)}`;
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
        <Monitor size={18} className="text-white/20 mx-auto mb-2" />
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
      {analyzed && summary && (
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
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
          <span className="text-white/10">|</span>
          {summary.sameScreenStreak > 0 ? (
            <span className="text-amber-400">
              Stale screen: ~{summary.sameScreenStreak * 10} min
            </span>
          ) : (
            <span className="text-white/30">No idle streaks</span>
          )}
        </div>
      )}

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
                  src={proxyUrl(ss.url)}
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

      {/* Timestamp labels row */}
      <div className="flex gap-2.5 overflow-hidden px-1">
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

/** Full-size screenshot modal overlay */
function ExpandedScreenshot({
  screenshot,
  analysis,
  onClose,
}: {
  screenshot: Screenshot;
  analysis?: Analysis;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-2xl max-w-3xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Monitor size={14} className="text-teal-400" />
            <span className="text-white/70 text-xs tabular-nums">
              {formatTimestamp(screenshot.recorded_at)}
            </span>
            {analysis && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                  analysis.flagged
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : analysis.onOnlyFans
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "bg-white/5 text-white/40 border border-white/10"
                }`}
              >
                {analysis.app} - {activityLabel(analysis)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {/* Full screenshot */}
        <div className="p-2">
          <img
            src={proxyUrl(screenshot.url)}
            alt="Full screenshot"
            className="w-full rounded-xl"
          />
        </div>

        {/* Analysis details */}
        {analysis && (
          <div className="px-4 py-3 border-t border-white/5">
            <p className="text-white/60 text-xs">{analysis.description}</p>
            {analysis.flagged && (
              <div className="mt-2 flex items-center gap-1.5 text-red-400 text-[11px]">
                <AlertTriangle size={11} />
                Flagged: Employee not on OnlyFans or idle
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

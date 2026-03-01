"use client";

import { X, Monitor, AlertTriangle } from "lucide-react";

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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function activityLabel(analysis: Analysis): string {
  const labels: Record<string, string> = {
    chatting: "Chatting", browsing: "Browsing", idle: "Idle",
    social_media: "Social Media", video: "Video", other: "Other",
  };
  return labels[analysis.activity] || "Other";
}

export function ExpandedScreenshot({
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

        <div className="p-2">
          <img
            src={screenshot.url}
            alt="Full screenshot"
            className="w-full rounded-xl"
          />
        </div>

        {analysis && (
          <div className="px-4 py-3 border-t border-white/5 space-y-2">
            <p className="text-white/60 text-xs">{analysis.description}</p>
            {analysis.reason && (
              <div className="glass-inset rounded-lg px-3 py-2">
                <p className="text-[10px] text-white/30 mb-0.5 font-medium">AI Reasoning</p>
                <p className="text-white/50 text-[11px] leading-relaxed">{analysis.reason}</p>
              </div>
            )}
            {analysis.analysisFailed && (
              <div className="mt-1 flex items-center gap-1.5 text-white/30 text-[11px]">
                <Monitor size={11} />
                Analysis could not be completed — screenshot may have expired
              </div>
            )}
            {analysis.flagged && !analysis.analysisFailed && (
              <div className="mt-1 flex items-center gap-1.5 text-red-400 text-[11px]">
                <AlertTriangle size={11} />
                Flagged: {analysis.reason || "Employee not on OnlyFans or idle"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

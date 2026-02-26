"use client";

import {
  Clock,
  MessageSquare,
  Target,
  Heart,
  DollarSign,
} from "lucide-react";

export interface ScoreEntry {
  email: string;
  chatterName: string | null;
  creatorName: string;
  creatorId: string;
  clockIn: string | null;
  isLive: boolean;
  currentScore: {
    totalScore: number;
    slaScore: number;
    followupScore: number;
    triggerScore: number;
    qualityScore: number;
    revenueScore: number;
    copyPastePenalty: number;
    missedTriggerPenalty: number;
    spamPenalty: number;
    detectedArchetype: string | null;
    windowStart: string;
    windowEnd: string;
    messagesAnalyzed: number;
    conversationsScanned: number;
    robotPhraseCount: number;
    aiNotes: string | null;
    notableQuotes: Array<{ text: string; type: "great" | "good" | "bad" | "ugly"; context: string }> | null;
    mistakeTags: string[];
    strengthTags: string[];
  } | null;
  profile: {
    avgTotalScore: number;
    avgSlaScore: number;
    avgFollowupScore: number;
    avgTriggerScore: number;
    avgQualityScore: number;
    avgRevenueScore: number;
    dominantArchetype: string | null;
    recentScores: number[] | null;
    improvementIndex: number;
    totalScoringSessions: number;
    topStrengths: string[];
    topWeaknesses: string[];
  } | null;
}

export const ARCHETYPE_CONFIG: Record<string, { label: string; color: string }> = {
  chameleon: { label: "Chameleon", color: "text-emerald-400" },
  sweetheart: { label: "Sweetheart", color: "text-pink-400" },
  aggressor: { label: "Aggressor", color: "text-orange-400" },
  tease: { label: "Tease", color: "text-purple-400" },
  yes_babe_robot: { label: "Yes Babe Robot", color: "text-red-500" },
  interview_bot: { label: "Interview Bot", color: "text-yellow-400" },
  doormat: { label: "Doormat", color: "text-red-400" },
  fact_bot: { label: "Fact Bot", color: "text-yellow-500" },
  friend_zone: { label: "Friend Zone", color: "text-blue-400" },
  vending_machine: { label: "Vending Machine", color: "text-gray-400" },
};

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 border-emerald-500/25";
  if (score >= 50) return "bg-yellow-500/15 border-yellow-500/25";
  return "bg-red-500/15 border-red-500/25";
}

export function CategoryBar({
  label,
  score,
  max,
  icon,
}: {
  label: string;
  score: number;
  max: number;
  icon: React.ReactNode;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2.5">
      <div className="text-white/30 w-4 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/50 text-[11px]">{label}</span>
          <span className="text-white/70 text-[11px] font-medium">
            {score}/{max}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${color} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function Sparkline({ scores }: { scores: number[] }) {
  if (!scores || scores.length < 2) return null;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * width;
      const y = height - ((s - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = scores[scores.length - 1] - scores[0];
  const strokeColor =
    trend > 5
      ? "stroke-emerald-400"
      : trend < -5
        ? "stroke-red-400"
        : "stroke-white/30";

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        className={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { Clock, MessageSquare, Target, Heart, DollarSign };

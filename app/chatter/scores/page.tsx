"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Bot,
  Sparkles,
  Clock,
  Target,
  Heart,
  DollarSign,
  Users,
} from "lucide-react";

interface ScoreEntry {
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

const ARCHETYPE_CONFIG: Record<string, { label: string; color: string }> = {
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

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 border-emerald-500/25";
  if (score >= 50) return "bg-yellow-500/15 border-yellow-500/25";
  return "bg-red-500/15 border-red-500/25";
}

function CategoryBar({
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

function Sparkline({ scores }: { scores: number[] }) {
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

export default function ChatterScores() {
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/chatter/scores");
      if (res.ok) {
        const data = await res.json();
        setScoreboard(data.scoreboard || []);
        setLastRefresh(new Date());
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 60000);
    return () => clearInterval(interval);
  }, [fetchScores]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchScores();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <a
              href="/chatter"
              className="glass-button w-10 h-10 rounded-xl flex items-center justify-center border border-solid border-white/10 hover:border-white/20 transition-colors"
            >
              <ArrowLeft size={18} className="text-white/70" />
            </a>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                Performance Scores
                <Trophy size={20} className="text-yellow-400" />
              </h1>
              <p className="text-white/40 text-sm mt-0.5">
                {scoreboard.length} chatter
                {scoreboard.length !== 1 ? "s" : ""} tracked
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/chatter/live"
              className="glass-button px-3 py-2 rounded-xl border border-solid border-white/10 flex items-center gap-2 hover:border-white/20 transition-colors"
            >
              <Users size={14} className="text-teal-400" />
              <span className="text-white/40 text-xs hidden sm:inline">
                Live
              </span>
            </a>
            <button
              onClick={handleRefresh}
              className="glass-button px-3 py-2 rounded-xl border border-solid border-white/10 flex items-center gap-2 hover:border-white/20 transition-colors"
            >
              <RefreshCw
                size={14}
                className={`text-white/50 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="text-white/40 text-xs hidden sm:inline">
                {lastRefresh.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="glass-panel rounded-3xl p-12 border border-solid border-white/10 text-center">
            <RefreshCw
              size={24}
              className="text-white/20 animate-spin mx-auto mb-4"
            />
            <p className="text-white/40">Loading scores...</p>
          </div>
        ) : scoreboard.length === 0 ? (
          /* Empty State */
          <div className="glass-panel rounded-3xl p-12 border border-solid border-white/10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-solid border-white/8 flex items-center justify-center mx-auto mb-5">
              <Trophy size={28} className="text-white/20" />
            </div>
            <p className="text-white/50 text-lg font-medium">
              No scores yet
            </p>
            <p className="text-white/25 text-sm mt-2 max-w-xs mx-auto">
              Scores appear after chatters clock in and the scoring cron runs.
              Check back in 30 minutes.
            </p>
          </div>
        ) : (
          /* Scoreboard */
          <div className="space-y-3">
            {scoreboard.map((entry, idx) => {
              const displayScore =
                entry.currentScore?.totalScore ??
                entry.profile?.avgTotalScore ??
                0;
              const displayName =
                entry.chatterName || entry.email.split("@")[0];
              const archetype =
                entry.currentScore?.detectedArchetype ||
                entry.profile?.dominantArchetype;
              const archetypeConfig = archetype
                ? ARCHETYPE_CONFIG[archetype]
                : null;
              const isExpanded = expandedIdx === idx;
              const recentScores = entry.profile?.recentScores as
                | number[]
                | null;
              const improvement = entry.profile?.improvementIndex ?? 0;

              return (
                <div
                  key={`${entry.email}-${entry.creatorId}`}
                  className="glass-card rounded-2xl border border-solid border-white/8 overflow-hidden"
                >
                  {/* Main Row */}
                  <button
                    onClick={() =>
                      setExpandedIdx(isExpanded ? null : idx)
                    }
                    className="w-full p-5 text-left"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Rank + Name */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Score Badge */}
                        <div
                          className={`w-12 h-12 rounded-xl border border-solid flex items-center justify-center shrink-0 ${scoreBgColor(displayScore)}`}
                        >
                          <span
                            className={`text-lg font-bold ${scoreColor(displayScore)}`}
                          >
                            {Math.round(displayScore)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-semibold truncate">
                              {displayName}
                            </p>
                            {entry.isLive && (
                              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
                            )}
                          </div>
                          <p className="text-white/40 text-xs mt-0.5">
                            {entry.creatorName}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {archetypeConfig && (
                              <span
                                className={`text-[10px] font-medium ${archetypeConfig.color}`}
                              >
                                {archetypeConfig.label}
                              </span>
                            )}
                            {improvement !== 0 && (
                              <span className="flex items-center gap-0.5">
                                {improvement > 0 ? (
                                  <TrendingUp
                                    size={10}
                                    className="text-emerald-400"
                                  />
                                ) : improvement < 0 ? (
                                  <TrendingDown
                                    size={10}
                                    className="text-red-400"
                                  />
                                ) : (
                                  <Minus
                                    size={10}
                                    className="text-white/30"
                                  />
                                )}
                                <span
                                  className={`text-[10px] ${improvement > 0 ? "text-emerald-400" : improvement < 0 ? "text-red-400" : "text-white/30"}`}
                                >
                                  {improvement > 0 ? "+" : ""}
                                  {improvement.toFixed(1)}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Sparkline + Sessions */}
                      <div className="flex items-center gap-3 shrink-0">
                        {recentScores && recentScores.length >= 2 && (
                          <Sparkline scores={recentScores} />
                        )}
                        {entry.profile && (
                          <span className="text-white/25 text-[10px]">
                            {entry.profile.totalScoringSessions} sessions
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-0 border-t border-solid border-white/5">
                      <div className="mt-4 space-y-2.5">
                        <CategoryBar
                          label="SLA / Response Time"
                          score={
                            entry.currentScore?.slaScore ??
                            Math.round(entry.profile?.avgSlaScore ?? 0)
                          }
                          max={25}
                          icon={<Clock size={12} />}
                        />
                        <CategoryBar
                          label="Follow-up Discipline"
                          score={
                            entry.currentScore?.followupScore ??
                            Math.round(
                              entry.profile?.avgFollowupScore ?? 0,
                            )
                          }
                          max={20}
                          icon={<MessageSquare size={12} />}
                        />
                        <CategoryBar
                          label="Trigger Handling"
                          score={
                            entry.currentScore?.triggerScore ??
                            Math.round(
                              entry.profile?.avgTriggerScore ?? 0,
                            )
                          }
                          max={20}
                          icon={<Target size={12} />}
                        />
                        <CategoryBar
                          label="Quality / Personalization"
                          score={
                            entry.currentScore?.qualityScore ??
                            Math.round(
                              entry.profile?.avgQualityScore ?? 0,
                            )
                          }
                          max={20}
                          icon={<Heart size={12} />}
                        />
                        <CategoryBar
                          label="Revenue Impact"
                          score={
                            entry.currentScore?.revenueScore ??
                            Math.round(
                              entry.profile?.avgRevenueScore ?? 0,
                            )
                          }
                          max={15}
                          icon={<DollarSign size={12} />}
                        />
                      </div>

                      {/* Penalties */}
                      {entry.currentScore &&
                        (entry.currentScore.copyPastePenalty !== 0 ||
                          entry.currentScore.missedTriggerPenalty !== 0 ||
                          entry.currentScore.spamPenalty !== 0) && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {entry.currentScore.copyPastePenalty !== 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
                                Copy/Paste -10
                              </span>
                            )}
                            {entry.currentScore.missedTriggerPenalty !==
                              0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
                                Missed Trigger -10
                              </span>
                            )}
                            {entry.currentScore.spamPenalty !== 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
                                Spam -10
                              </span>
                            )}
                          </div>
                        )}

                      {/* Tags */}
                      {(entry.currentScore?.strengthTags?.length ?? 0) >
                        0 && (
                        <div className="mt-3">
                          <span className="text-white/30 text-[10px] uppercase tracking-wider">
                            Strengths
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.currentScore!.strengthTags.map(
                              (tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-solid border-emerald-500/20"
                                >
                                  {tag.replace(/_/g, " ")}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {(entry.currentScore?.mistakeTags?.length ?? 0) >
                        0 && (
                        <div className="mt-2">
                          <span className="text-white/30 text-[10px] uppercase tracking-wider">
                            Needs Improvement
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.currentScore!.mistakeTags.map(
                              (tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-solid border-orange-500/20"
                                >
                                  {tag.replace(/_/g, " ")}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Notable Quotes */}
                      {entry.currentScore?.notableQuotes && entry.currentScore.notableQuotes.length > 0 && (
                        <div className="mt-3">
                          <span className="text-white/30 text-[10px] uppercase tracking-wider">
                            Notable Quotes
                          </span>
                          <div className="mt-1.5 space-y-1.5">
                            {entry.currentScore.notableQuotes.map((q, qi) => (
                              <div key={qi} className={`p-2.5 rounded-xl border border-solid ${
                                q.type === "great" ? "bg-emerald-500/5 border-emerald-500/15" :
                                q.type === "good" ? "bg-teal-500/5 border-teal-500/15" :
                                q.type === "bad" ? "bg-orange-500/5 border-orange-500/15" :
                                "bg-red-500/5 border-red-500/15"
                              }`}>
                                <div className="flex items-start gap-2">
                                  <span className="text-sm shrink-0 mt-0.5">
                                    {q.type === "great" ? "⭐" : q.type === "good" ? "✅" : q.type === "bad" ? "⚠️" : "💀"}
                                  </span>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-medium italic ${
                                      q.type === "great" ? "text-emerald-400/90" :
                                      q.type === "good" ? "text-teal-400/90" :
                                      q.type === "bad" ? "text-orange-400/90" :
                                      "text-red-400/90"
                                    }`}>
                                      &ldquo;{q.text}&rdquo;
                                    </p>
                                    {q.context && (
                                      <p className="text-white/25 text-[10px] mt-0.5">{q.context}</p>
                                    )}
                                  </div>
                                  <span className={`text-[9px] uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-md ${
                                    q.type === "great" ? "bg-emerald-500/10 text-emerald-400/70" :
                                    q.type === "good" ? "bg-teal-500/10 text-teal-400/70" :
                                    q.type === "bad" ? "bg-orange-500/10 text-orange-400/70" :
                                    "bg-red-500/10 text-red-400/70"
                                  }`}>
                                    {q.type}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Notes */}
                      {entry.currentScore?.aiNotes && (
                        <div className="mt-3 p-3 rounded-xl bg-white/3 border border-solid border-white/5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles
                              size={10}
                              className="text-purple-400"
                            />
                            <span className="text-white/30 text-[10px] uppercase tracking-wider">
                              AI Notes
                            </span>
                          </div>
                          <p className="text-white/60 text-xs leading-relaxed">
                            {entry.currentScore.aiNotes}
                          </p>
                        </div>
                      )}

                      {/* Stats Row */}
                      {entry.currentScore && (
                        <div className="mt-3 flex items-center gap-4 text-white/30 text-[10px]">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={9} />
                            {entry.currentScore.messagesAnalyzed} msgs
                          </span>
                          <span>
                            {entry.currentScore.conversationsScanned}{" "}
                            chats
                          </span>
                          <span className="flex items-center gap-1">
                            <Bot size={9} />
                            {entry.currentScore.robotPhraseCount} robot
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {scoreboard.length > 0 && (
          <div className="mt-6 glass-panel rounded-2xl p-4 border border-solid border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={12} className="text-white/25" />
              <span className="text-white/40 text-xs">
                Auto-refreshes every 60 seconds
              </span>
            </div>
            <a
              href="/chatter"
              className="text-sm text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={12} />
              Clock-In
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

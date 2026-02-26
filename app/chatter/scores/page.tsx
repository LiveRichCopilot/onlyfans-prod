"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
} from "lucide-react";
import {
  type ScoreEntry,
  ARCHETYPE_CONFIG,
  scoreColor,
  scoreBgColor,
  Sparkline,
} from "@/components/chatter/scores/ScoreComponents";
import { ScoreExpandedDetail } from "@/components/chatter/scores/ScoreExpandedDetail";

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
              <span className="text-white/40 text-xs hidden sm:inline">Live</span>
            </a>
            <button
              onClick={handleRefresh}
              className="glass-button px-3 py-2 rounded-xl border border-solid border-white/10 flex items-center gap-2 hover:border-white/20 transition-colors"
            >
              <RefreshCw size={14} className={`text-white/50 ${refreshing ? "animate-spin" : ""}`} />
              <span className="text-white/40 text-xs hidden sm:inline">
                {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="glass-panel rounded-3xl p-12 border border-solid border-white/10 text-center">
            <RefreshCw size={24} className="text-white/20 animate-spin mx-auto mb-4" />
            <p className="text-white/40">Loading scores...</p>
          </div>
        ) : scoreboard.length === 0 ? (
          /* Empty State */
          <div className="glass-panel rounded-3xl p-12 border border-solid border-white/10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-solid border-white/8 flex items-center justify-center mx-auto mb-5">
              <Trophy size={28} className="text-white/20" />
            </div>
            <p className="text-white/50 text-lg font-medium">No scores yet</p>
            <p className="text-white/25 text-sm mt-2 max-w-xs mx-auto">
              Scores appear after chatters clock in and the scoring cron runs. Check back in 30 minutes.
            </p>
          </div>
        ) : (
          /* Scoreboard */
          <div className="space-y-3">
            {scoreboard.map((entry, idx) => {
              const displayScore = entry.currentScore?.totalScore ?? entry.profile?.avgTotalScore ?? 0;
              const displayName = entry.chatterName || entry.email.split("@")[0];
              const archetype = entry.currentScore?.detectedArchetype || entry.profile?.dominantArchetype;
              const archetypeConfig = archetype ? ARCHETYPE_CONFIG[archetype] : null;
              const isExpanded = expandedIdx === idx;
              const recentScores = entry.profile?.recentScores as number[] | null;
              const improvement = entry.profile?.improvementIndex ?? 0;

              return (
                <div
                  key={`${entry.email}-${entry.creatorId}`}
                  className="glass-card rounded-2xl border border-solid border-white/8 overflow-hidden"
                >
                  {/* Main Row */}
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="w-full p-5 text-left"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Rank + Name */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-12 h-12 rounded-xl border border-solid flex items-center justify-center shrink-0 ${scoreBgColor(displayScore)}`}>
                          <span className={`text-lg font-bold ${scoreColor(displayScore)}`}>
                            {Math.round(displayScore)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                            {entry.isLive && (
                              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
                            )}
                          </div>
                          <p className="text-white/40 text-xs mt-0.5">{entry.creatorName}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {archetypeConfig && (
                              <span className={`text-[10px] font-medium ${archetypeConfig.color}`}>
                                {archetypeConfig.label}
                              </span>
                            )}
                            {improvement !== 0 && (
                              <span className="flex items-center gap-0.5">
                                {improvement > 0 ? (
                                  <TrendingUp size={10} className="text-emerald-400" />
                                ) : improvement < 0 ? (
                                  <TrendingDown size={10} className="text-red-400" />
                                ) : (
                                  <Minus size={10} className="text-white/30" />
                                )}
                                <span className={`text-[10px] ${improvement > 0 ? "text-emerald-400" : improvement < 0 ? "text-red-400" : "text-white/30"}`}>
                                  {improvement > 0 ? "+" : ""}{improvement.toFixed(1)}
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
                  {isExpanded && <ScoreExpandedDetail entry={entry} />}
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
              <span className="text-white/40 text-xs">Auto-refreshes every 60 seconds</span>
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

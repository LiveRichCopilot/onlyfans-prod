"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { scoreColor } from "./chart-colors";

type TeamMember = {
  userId: number;
  name: string;
  email: string;
  role: string;
  hasReports: boolean;
  reportsCount: number;
  avgScore: number | null;
  lifetimeAvg: number | null;
  lifetimeSessions: number;
  lastScored: string | null;
  creators: string[];
};

type Team = {
  teamId: number;
  teamName: string;
  memberCount: number;
  scoredCount: number;
  teamAvgScore: number | null;
  members: TeamMember[];
};

type Props = {
  days: number;
  onChatterClick?: (email: string) => void;
};

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function scoreBadgeColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (score >= 60) return "bg-teal-500/20 text-teal-400 border-teal-500/30";
  if (score >= 40) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export function TeamReportsPanel({ days, onChatterClick }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalScored, setTotalScored] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team-analytics/team-reports?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setTeams(json.teams || []);
        setTotalMembers(json.totalMembers || 0);
        setTotalScored(json.totalScored || 0);
        // Auto-expand teams that have scored members
        const autoExpand = new Set<number>();
        for (const t of json.teams || []) {
          if (t.scoredCount > 0) autoExpand.add(t.teamId);
        }
        setExpandedTeams(autoExpand);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const toggleTeam = (teamId: number) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  return (
    <div className="glass-card rounded-3xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Users size={15} className="text-teal-400" />
            Chatter Reports by Team
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            {totalScored} of {totalMembers} chatters have reports in the last {days} days
            {onChatterClick && (
              <span className="text-teal-400/50 ml-1">
                — click name for shift report
              </span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 px-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-teal-400" />
          <span className="text-white/40 text-[10px]">
            <span className="text-white/60 font-medium">Scored</span> — has
            report(s)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle size={11} className="text-white/20" />
          <span className="text-white/40 text-[10px]">
            <span className="text-white/60 font-medium">Not scored</span> — no
            reports yet
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-white/40 text-[10px]">80+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
          <span className="text-white/40 text-[10px]">60-79</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-white/40 text-[10px]">40-59</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-white/40 text-[10px]">&lt;40</span>
        </div>
      </div>

      {loading && teams.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
        </div>
      ) : teams.length === 0 ? (
        <div className="flex items-center justify-center text-white/20 text-xs py-8 gap-2">
          <Users size={14} />
          <span>No Hubstaff teams found</span>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => {
            const isExpanded = expandedTeams.has(team.teamId);
            const completionPct =
              team.memberCount > 0
                ? Math.round((team.scoredCount / team.memberCount) * 100)
                : 0;

            return (
              <div key={team.teamId} className="glass-inset rounded-2xl overflow-hidden">
                {/* Team header row */}
                <button
                  onClick={() => toggleTeam(team.teamId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-white/30 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-white/30 shrink-0" />
                  )}

                  {/* Team name */}
                  <span className="text-white font-medium text-sm capitalize min-w-[80px] text-left">
                    {team.teamName}
                  </span>

                  {/* Completion bar */}
                  <div className="flex-1 max-w-[200px]">
                    <div className="h-1.5 glass-inset rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${completionPct}%`,
                          background:
                            completionPct === 100
                              ? "#2dd4bf"
                              : completionPct >= 50
                              ? "#fbbf24"
                              : "#f87171",
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <span className="text-white/30 text-[10px] tabular-nums shrink-0">
                    {team.scoredCount}/{team.memberCount} scored
                  </span>

                  {team.teamAvgScore !== null && (
                    <span
                      className="text-xs font-bold tabular-nums shrink-0"
                      style={{ color: scoreColor(team.teamAvgScore) }}
                    >
                      {team.teamAvgScore}
                    </span>
                  )}
                </button>

                {/* Expanded member list */}
                {isExpanded && team.members.length > 0 && (
                  <div className="border-t border-white/5 px-3 py-2 space-y-1">
                    {/* Column header */}
                    <div className="grid grid-cols-[1fr_80px_70px_60px_70px] gap-2 text-[10px] text-white/25 px-2 py-1">
                      <span>Chatter</span>
                      <span>Creator(s)</span>
                      <span>Reports</span>
                      <span>Score</span>
                      <span>Last Scored</span>
                    </div>

                    {team.members.map((member) => (
                      <div
                        key={member.userId}
                        onClick={() =>
                          member.email && onChatterClick?.(member.email)
                        }
                        className={`grid grid-cols-[1fr_80px_70px_60px_70px] gap-2 items-center px-2 py-2 rounded-xl transition-colors ${
                          onChatterClick && member.email
                            ? "cursor-pointer hover:bg-white/[0.03]"
                            : ""
                        }`}
                      >
                        {/* Name + status icon */}
                        <div className="flex items-center gap-2 min-w-0">
                          {member.hasReports ? (
                            <CheckCircle2
                              size={12}
                              className="text-teal-400 shrink-0"
                            />
                          ) : (
                            <XCircle
                              size={12}
                              className="text-white/15 shrink-0"
                            />
                          )}
                          <span
                            className={`text-xs font-medium truncate ${
                              member.hasReports
                                ? "text-white"
                                : "text-white/30"
                            }`}
                          >
                            {member.name}
                          </span>
                        </div>

                        {/* Creator(s) */}
                        <span className="text-white/30 text-[10px] truncate">
                          {member.creators.length > 0
                            ? member.creators.join(", ")
                            : "—"}
                        </span>

                        {/* Reports count */}
                        <span
                          className={`text-[10px] tabular-nums ${
                            member.hasReports
                              ? "text-white/50"
                              : "text-white/15"
                          }`}
                        >
                          {member.reportsCount > 0
                            ? `${member.reportsCount} report${member.reportsCount !== 1 ? "s" : ""}`
                            : "None"}
                        </span>

                        {/* Score badge */}
                        <div>
                          {member.avgScore !== null ? (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums border ${scoreBadgeColor(member.avgScore)}`}
                            >
                              {member.avgScore}
                            </span>
                          ) : (
                            <span className="text-white/15 text-[10px]">
                              —
                            </span>
                          )}
                        </div>

                        {/* Last scored */}
                        <span className="text-white/25 text-[10px] tabular-nums flex items-center gap-1">
                          {member.lastScored ? (
                            <>
                              <Clock size={9} className="shrink-0" />
                              {timeAgo(member.lastScored)}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Radio,
  Clock,
  User,
  RefreshCw,
  Users,
  Trophy,
  LogOut,
} from "lucide-react";

interface LiveSession {
  id: string;
  email: string;
  clockIn: string;
  source?: string;
  creator: { name: string | null };
  keyboardPct?: number | null;
  mousePct?: number | null;
  overallActivity?: number | null;
}

export default function ChatterLive() {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [clockingOut, setClockingOut] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/chatter/live");
      if (res.ok) {
        const data = await res.json();
        setLiveSessions(data);
        setLastRefresh(new Date());
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  async function handleManualRefresh() {
    setRefreshing(true);
    await fetchLive();
    setTimeout(() => setRefreshing(false), 600);
  }

  function formatClockInTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function duration(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const totalMins = Math.floor(diff / 60000);
    if (totalMins < 1) return "Just started";
    if (totalMins < 60) return `${totalMins}m`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m`;
  }

  async function handleClockOut(email: string) {
    if (!confirm(`Clock out ${email}?`)) return;
    setClockingOut(email);
    try {
      const res = await fetch("/api/chatter/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setLiveSessions((prev) => prev.filter((s) => s.email !== email));
      }
    } catch {
      // silent fail
    } finally {
      setClockingOut(null);
    }
  }

  // Keep durations ticking by re-rendering every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

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
                Live Chatters
                {liveSessions.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                )}
              </h1>
              <p className="text-white/40 text-sm mt-0.5">
                {liveSessions.length} chatter
                {liveSessions.length !== 1 ? "s" : ""} currently online
              </p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
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

        {/* Empty State */}
        {liveSessions.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 border border-solid border-white/10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-solid border-white/8 flex items-center justify-center mx-auto mb-5">
              <Users size={28} className="text-white/20" />
            </div>
            <p className="text-white/50 text-lg font-medium">
              No chatters currently live
            </p>
            <p className="text-white/25 text-sm mt-2 max-w-xs mx-auto">
              Sessions will appear here when chatters clock in. Auto-refreshes
              every 30 seconds.
            </p>
            <a
              href="/chatter"
              className="inline-flex items-center gap-2 mt-6 text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              <ArrowLeft size={14} />
              Go to Clock-In
            </a>
          </div>
        ) : (
          /* Session Cards */
          <div className="space-y-3">
            {liveSessions.map((session) => (
              <div
                key={session.id}
                className="glass-card rounded-2xl p-5 border border-solid border-white/8"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Chatter Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-solid border-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={18} className="text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {session.email}
                      </p>
                      <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1.5">
                        {session.creator.name || "Unknown creator"}
                        {session.source === "hubstaff" && (
                          <span className="bg-teal-500/15 text-teal-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-teal-500/20">HUBSTAFF</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock size={11} className="text-white/25" />
                        <span className="text-white/30 text-xs">
                          Clocked in at {formatClockInTime(session.clockIn)}
                        </span>
                      </div>
                      {session.overallActivity != null && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-white/30">Activity:</span>
                          <span className="text-[10px] tabular-nums" style={{ color: session.overallActivity >= 60 ? "#34d399" : session.overallActivity >= 30 ? "#fbbf24" : "#f87171" }}>
                            {session.overallActivity}% overall
                          </span>
                          {session.keyboardPct != null && (
                            <span className="text-[10px] text-white/30 tabular-nums">{session.keyboardPct}% keys</span>
                          )}
                          {session.mousePct != null && (
                            <span className="text-[10px] text-white/30 tabular-nums">{session.mousePct}% mouse</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Duration + Clock Out */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                      <span className="text-teal-400 text-sm font-semibold">
                        {duration(session.clockIn)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleClockOut(session.email)}
                      disabled={clockingOut === session.email}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-solid border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50"
                    >
                      <LogOut size={11} />
                      {clockingOut === session.email ? "..." : "Clock Out"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Stats Bar */}
        {liveSessions.length > 0 && (
          <div className="mt-6 glass-panel rounded-2xl p-4 border border-solid border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-teal-400" />
              <span className="text-white/50 text-xs">
                Auto-refreshes every 30 seconds
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/chatter/scores"
                className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1.5"
              >
                <Trophy size={12} />
                Scores
              </a>
              <a
                href="/chatter"
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={12} />
                Clock-In Page
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

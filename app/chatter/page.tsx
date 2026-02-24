"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LogIn,
  LogOut,
  Mail,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Radio,
} from "lucide-react";

interface Creator {
  id: string;
  name: string | null;
}

interface LiveSession {
  id: string;
  email: string;
  clockIn: string;
  creator: { name: string | null };
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="tabular-nums text-teal-400 text-lg font-mono font-semibold">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

export default function ChatterClockIn() {
  const [email, setEmail] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [chatterName, setChatterName] = useState<string | null>(null);
  const [shift, setShift] = useState<string | null>(null);
  const [isCover, setIsCover] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/chatter/live");
      if (res.ok) setLiveSessions(await res.json());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  // Check if current email is already clocked in
  useEffect(() => {
    if (email && emailLocked) {
      const session = liveSessions.find(
        (s) => s.email.toLowerCase() === email.toLowerCase()
      );
      setIsClockedIn(!!session);
      setActiveSession(session || null);
    } else {
      setIsClockedIn(false);
      setActiveSession(null);
    }
  }, [email, emailLocked, liveSessions]);

  // Look up email in schedule
  async function handleEmailLookup() {
    if (!email.trim()) return;
    setLoading(true);
    setNotFound(false);
    setMessage(null);

    try {
      const res = await fetch(`/api/chatter/creators?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();

      if (data.creators && data.creators.length > 0) {
        setCreators(data.creators);
        setChatterName(data.chatterName);
        setShift(data.shift);
        setIsCover(data.isCover);
        setEmailLocked(true);
        setCreatorId(data.creators[0]?.id || "");
      } else {
        setNotFound(true);
        setCreators([]);
        setChatterName(null);
      }
    } catch {
      setMessage({ text: "Network error looking up schedule.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function handleEmailReset() {
    setEmailLocked(false);
    setCreators([]);
    setCreatorId("");
    setChatterName(null);
    setShift(null);
    setIsCover(false);
    setNotFound(false);
    setMessage(null);
  }

  async function handleClockIn() {
    if (!email || !creatorId) {
      setMessage({ text: "Please select a model.", type: "error" });
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/chatter/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), creatorId }),
      });

      if (res.ok) {
        const selectedCreator = creators.find((c) => c.id === creatorId);
        setMessage({ text: `Clocked in for ${selectedCreator?.name || "creator"}!`, type: "success" });
        await fetchLive();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Clock-in failed.", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleClockOut() {
    if (!email) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/chatter/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setMessage({ text: "Clocked out. See you next shift!", type: "success" });
        await fetchLive();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Clock-out failed.", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function timeSince(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Main Clock-In Panel */}
        <div className="glass-panel rounded-3xl p-8 border border-solid border-white/10">
          {/* Header with Live Clock */}
          <div className="text-center mb-8">
            <LiveClock />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-3">
              Chatter Clock-In
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Enter your email to start your shift
            </p>
          </div>

          {/* Chatter Info Banner */}
          {chatterName && (
            <div className="mb-6 rounded-2xl bg-white/[0.03] border border-solid border-white/10 p-4">
              <p className="text-white font-semibold text-sm">{chatterName}</p>
              <p className="text-white/40 text-xs mt-0.5">
                Shift: {shift} UTC {isCover ? " (Cover)" : ""}
              </p>
            </div>
          )}

          {/* Active Session Banner */}
          {isClockedIn && activeSession && (
            <div className="mb-6 rounded-2xl bg-teal-500/[0.08] border border-solid border-teal-500/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-teal-400 text-sm font-semibold">Currently Live</p>
                  <p className="text-white/50 text-xs truncate">
                    {activeSession.creator.name || "Unknown"} &middot; {timeSince(activeSession.clockIn)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-white/60 text-xs font-medium uppercase tracking-wider mb-2">
              Your Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !emailLocked && handleEmailLookup()}
                disabled={emailLocked}
                placeholder="you@liverich.travel"
                className="glass-inset w-full rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/25 outline-none focus:ring-2 focus:ring-teal-500/40 transition-shadow text-sm disabled:opacity-60"
              />
            </div>
            {!emailLocked ? (
              <button
                onClick={handleEmailLookup}
                disabled={loading || !email.trim()}
                className="mt-3 w-full glass-button rounded-xl py-3 text-white/80 font-medium text-sm border border-solid border-white/10 hover:border-teal-500/30 transition-colors disabled:opacity-40"
              >
                {loading ? "Looking up..." : "Look Up Schedule"}
              </button>
            ) : (
              <button
                onClick={handleEmailReset}
                className="mt-2 text-white/30 text-xs hover:text-white/60 transition-colors"
              >
                Change email
              </button>
            )}
          </div>

          {/* Not Found */}
          {notFound && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-solid border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              Email not found in schedule. Contact your manager.
            </div>
          )}

          {/* Creator Dropdown (only shown after email lookup) */}
          {emailLocked && !isClockedIn && creators.length > 0 && (
            <div className="mb-6">
              <label className="block text-white/60 text-xs font-medium uppercase tracking-wider mb-2">
                Model
              </label>
              <div className="relative">
                <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <select
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                  className="glass-inset w-full rounded-xl pl-11 pr-10 py-3.5 text-white outline-none focus:ring-2 focus:ring-teal-500/40 transition-shadow appearance-none cursor-pointer text-sm"
                >
                  {creators.map((c) => (
                    <option key={c.id} value={c.id} className="bg-neutral-900">
                      {c.name || c.id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Action Button */}
          {emailLocked && (
            isClockedIn ? (
              <button
                onClick={handleClockOut}
                disabled={loading}
                className="w-full glass-button rounded-xl py-3.5 px-6 text-red-400 font-semibold text-base transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 border border-solid border-red-500/20 flex items-center justify-center gap-2.5"
              >
                <LogOut size={18} />
                {loading ? "Clocking out..." : "Clock Out"}
              </button>
            ) : creators.length > 0 ? (
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="w-full glass-prominent rounded-xl py-3.5 px-6 text-white font-semibold text-base transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
              >
                <LogIn size={18} />
                {loading ? "Clocking in..." : "Clock In"}
              </button>
            ) : null
          )}

          {/* Status Message */}
          {message && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2.5 ${
              message.type === "success"
                ? "bg-teal-500/10 text-teal-400 border border-solid border-teal-500/20"
                : "bg-red-500/10 text-red-400 border border-solid border-red-500/20"
            }`}>
              {message.type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
              {message.text}
            </div>
          )}
        </div>

        {/* Live Link */}
        <a
          href="/chatter/live"
          className="glass-panel rounded-2xl p-4 border border-solid border-white/10 flex items-center justify-between group hover:border-teal-500/20 transition-colors block"
        >
          <div className="flex items-center gap-3">
            <Radio size={16} className="text-teal-400" />
            <span className="text-white/70 text-sm font-medium group-hover:text-white/90 transition-colors">
              See who&apos;s live right now
            </span>
          </div>
          <div className="flex items-center gap-2">
            {liveSessions.length > 0 && (
              <span className="text-xs text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-solid border-teal-500/20">
                {liveSessions.length} online
              </span>
            )}
            <ChevronDown size={14} className="text-white/30 -rotate-90" />
          </div>
        </a>
      </div>
    </div>
  );
}

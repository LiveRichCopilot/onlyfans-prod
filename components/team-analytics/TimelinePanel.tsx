"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";

type Block = {
  startsAt: string;
  tracked: number;
  activityPct: number;
};

type MemberRow = {
  userId: number;
  name: string;
  email: string;
  totalTrackedSeconds: number;
  blocks: Block[];
};

function todayUK(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function formatHours(seconds: number): string {
  if (seconds === 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function shiftDate(dateStr: string, offset: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Convert UTC timestamp to fractional hours in UK timezone */
function toUKHour(isoStr: string): number {
  const d = new Date(isoStr);
  const ukStr = d.toLocaleString("en-US", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [h, m] = ukStr.split(":").map(Number);
  return h + m / 60;
}

function blockColor(pct: number): string {
  if (pct >= 60) return "rgba(45, 212, 191, 0.85)";    // teal — active
  if (pct >= 30) return "rgba(45, 212, 191, 0.45)";    // teal dim — moderate
  if (pct > 0)   return "rgba(251, 191, 36, 0.45)";    // amber — low
  return "rgba(107, 114, 128, 0.25)";                   // gray — idle
}

function currentUKHour(): number {
  const ukStr = new Date().toLocaleString("en-US", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const [h, m] = ukStr.split(":").map(Number);
  return h + m / 60;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const BLOCK_WIDTH_PCT = (10 / 1440) * 100; // 10 min = 0.694% of 24h

type Props = {
  creatorId?: string;
};

export function TimelinePanel({ creatorId }: Props) {
  const [date, setDate] = useState(todayUK());
  const [data, setData] = useState<MemberRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowHour, setNowHour] = useState(currentUKHour());
  const [hoveredBlock, setHoveredBlock] = useState<{
    name: string; pct: number; time: string; x: number; y: number;
  } | null>(null);

  const isToday = date === todayUK();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (creatorId && creatorId !== "all") params.set("creatorId", creatorId);
      const res = await fetch(`/api/team-analytics/timeline?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.members || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [date, creatorId]);

  useEffect(() => { load(); }, [load]);

  // Update current time indicator every 60s
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => setNowHour(currentUKHour()), 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  const members = data || [];
  const hasData = members.some(m => m.blocks.length > 0);

  return (
    <div className="glass-card rounded-3xl p-6">
      {/* Header: title + date nav */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Clock size={15} className="text-teal-400" />
            Timeline
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            24-hour activity blocks per member (UK time)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDate(d => shiftDate(d, -1))}
            className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white"
          >
            <ChevronLeft size={14} />
          </button>
          {!isToday && (
            <button
              onClick={() => setDate(todayUK())}
              className="glass-button rounded-lg px-2.5 py-1 text-[10px] text-teal-400 font-medium"
            >
              Today
            </button>
          )}
          <span className="text-white/60 text-xs font-medium min-w-[140px] text-center">
            {formatDate(date)}
          </span>
          <button
            onClick={() => setDate(d => shiftDate(d, 1))}
            disabled={isToday}
            className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={load}
            className="glass-button rounded-lg p-1.5 text-white/40 hover:text-white ml-1"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center text-white/20 text-xs py-8 gap-2">
          <Clock size={14} />
          <span>No Hubstaff activity recorded for {formatDate(date)}</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Hour axis */}
          <div className="flex">
            <div className="w-[140px] shrink-0" />
            <div className="w-[52px] shrink-0" />
            <div className="flex-1 relative h-6">
              {HOURS.map(h => (
                <span
                  key={h}
                  className="absolute text-[9px] text-white/30 tabular-nums -translate-x-1/2"
                  style={{ left: `${(h / 24) * 100}%`, top: 0 }}
                >
                  {h === 0 ? "0:00" : h % 3 === 0 ? `${h}:00` : ""}
                </span>
              ))}
            </div>
          </div>

          {/* Member rows */}
          <div className="space-y-1">
            {members.filter(m => m.blocks.length > 0 || m.totalTrackedSeconds > 0).map(member => (
              <div key={member.userId} className="flex items-center group">
                {/* Name */}
                <div className="w-[140px] shrink-0 pr-2 min-w-0">
                  <span className="text-white text-xs font-medium truncate block">
                    {member.name}
                  </span>
                </div>
                {/* Hours */}
                <div className="w-[52px] shrink-0 text-right pr-3">
                  <span className="text-white/40 text-[10px] tabular-nums font-medium">
                    {formatHours(member.totalTrackedSeconds)}
                  </span>
                </div>
                {/* Timeline bar */}
                <div className="flex-1 relative h-7 glass-inset rounded-lg overflow-hidden">
                  {/* Hour grid lines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px"
                      style={{
                        left: `${(h / 24) * 100}%`,
                        background: h % 6 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                      }}
                    />
                  ))}

                  {/* Activity blocks */}
                  {member.blocks.map((block, i) => {
                    const ukH = toUKHour(block.startsAt);
                    const leftPct = (ukH / 24) * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0.5 bottom-0.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                        style={{
                          left: `${leftPct}%`,
                          width: `${BLOCK_WIDTH_PCT}%`,
                          minWidth: "2px",
                          background: blockColor(block.activityPct),
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredBlock({
                            name: member.name,
                            pct: block.activityPct,
                            time: new Date(block.startsAt).toLocaleTimeString("en-GB", {
                              timeZone: "Europe/London",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                            x: rect.left + rect.width / 2,
                            y: rect.top - 8,
                          });
                        }}
                        onMouseLeave={() => setHoveredBlock(null)}
                      />
                    );
                  })}

                  {/* Current time line */}
                  {isToday && (
                    <div
                      className="absolute top-0 bottom-0 w-px z-10"
                      style={{
                        left: `${(nowHour / 24) * 100}%`,
                        background: "rgba(248, 113, 113, 0.6)",
                        borderLeft: "1px dashed rgba(248, 113, 113, 0.4)",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Members with zero activity */}
            {members.filter(m => m.blocks.length === 0 && m.totalTrackedSeconds === 0).length > 0 && (
              <div className="pt-2 border-t border-white/5 mt-2">
                <span className="text-white/20 text-[10px] pl-1">Not tracked today:</span>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-1 mt-1">
                  {members
                    .filter(m => m.blocks.length === 0)
                    .map(m => (
                      <span key={m.userId} className="text-white/15 text-[10px]">{m.name}</span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend with explanations */}
          <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(45, 212, 191, 0.85)" }} />
                <span className="text-white/40 text-[9px]"><span className="text-white/60 font-medium">60%+</span> Active — working normally</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(45, 212, 191, 0.45)" }} />
                <span className="text-white/40 text-[9px]"><span className="text-white/60 font-medium">30-59%</span> Moderate — some activity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(251, 191, 36, 0.45)" }} />
                <span className="text-white/40 text-[9px]"><span className="text-white/60 font-medium">&lt;30%</span> Low — barely active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ background: "rgba(107, 114, 128, 0.25)" }} />
                <span className="text-white/40 text-[9px]">No blocks = not tracked</span>
              </div>
              {isToday && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="w-px h-3 border-l border-dashed border-red-400/60" />
                  <span className="text-white/30 text-[9px]">Current time</span>
                </div>
              )}
            </div>
            <p className="text-white/20 text-[9px]">
              Each block = 10 minutes. Color shows what % of that time had keyboard or mouse input. Gaps = Hubstaff tracker was paused or offline.
            </p>
          </div>
        </div>
      )}

      {/* Floating tooltip */}
      {hoveredBlock && (
        <div
          className="fixed z-50 glass-card rounded-xl px-3 py-2 pointer-events-none shadow-xl border border-white/10"
          style={{
            left: hoveredBlock.x,
            top: hoveredBlock.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-white text-[10px] font-medium">{hoveredBlock.name}</div>
          <div className="text-white/50 text-[9px]">
            {hoveredBlock.time} — <span
              className="font-bold"
              style={{ color: hoveredBlock.pct >= 60 ? "#2dd4bf" : hoveredBlock.pct >= 30 ? "#fbbf24" : "#f87171" }}
            >
              {hoveredBlock.pct}% activity
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

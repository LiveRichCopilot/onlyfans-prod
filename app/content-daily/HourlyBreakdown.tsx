"use client";

import { Clock, ChevronDown } from "lucide-react";

type HourSlot = { hour: number; count: number; sources: Record<string, number>; creators: string[] };
type HourlyDay = { date: string; hours: HourSlot[] };

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

export default function HourlyBreakdown({
  hourly,
  expanded,
  onToggle,
}: {
  hourly: HourlyDay[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (!hourly || hourly.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl mb-6 overflow-hidden">
      <button onClick={() => onToggle("hourly")} className="w-full flex items-center justify-between p-4 text-left">
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock size={14} className="text-teal-400" /> Hour-by-Hour Breakdown
        </span>
        <ChevronDown size={16} className={`text-white/50 transition-transform ${expanded.has("hourly") ? "rotate-180" : ""}`} />
      </button>
      {expanded.has("hourly") && (
        <div className="px-4 pb-4 space-y-4">
          {hourly.map((day) => {
            const totalDay = day.hours.reduce((s, h) => s + h.count, 0);
            const maxCount = Math.max(...day.hours.map((h) => h.count), 1);
            // Find gaps (hours with 0 content during active window)
            const activeHours = day.hours.filter((h) => h.count > 0);
            const firstActive = activeHours.length > 0 ? activeHours[0].hour : 0;
            const lastActive = activeHours.length > 0 ? activeHours[activeHours.length - 1].hour : 23;
            return (
              <div key={day.date}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-white font-medium">{day.date}</span>
                  <span className="text-xs text-white/40">{totalDay} total</span>
                </div>
                <div className="flex gap-px">
                  {day.hours.map((slot) => {
                    const isActive = slot.hour >= firstActive && slot.hour <= lastActive;
                    const barHeight = slot.count > 0 ? Math.max(8, (slot.count / maxCount) * 48) : 0;
                    const isGap = isActive && slot.count === 0;
                    return (
                      <div key={slot.hour} className="flex-1 flex flex-col items-center group relative">
                        {/* Bar */}
                        <div className="w-full flex items-end justify-center" style={{ height: 52 }}>
                          {slot.count > 0 ? (
                            <div
                              className={`w-full rounded-t-sm ${
                                slot.sources.direct_message ? "bg-purple-500/60" :
                                slot.sources.wall_post ? "bg-blue-500/60" :
                                "bg-teal-500/60"
                              }`}
                              style={{ height: barHeight }}
                            />
                          ) : isGap ? (
                            <div className="w-full h-1 bg-red-500/30 rounded-full" />
                          ) : null}
                        </div>
                        {/* Count */}
                        {slot.count > 0 && (
                          <span className="text-[9px] text-white/70 mt-0.5">{slot.count}</span>
                        )}
                        {/* Hour label (show every 3 hours) */}
                        {slot.hour % 3 === 0 && (
                          <span className="text-[8px] text-white/30 mt-0.5">{formatHour(slot.hour)}</span>
                        )}
                        {/* Tooltip */}
                        {slot.count > 0 && (
                          <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 glass-panel rounded-lg p-2 min-w-[120px] text-left">
                            <div className="text-xs text-white font-medium mb-1">{formatHour(slot.hour)} — {slot.count} sent</div>
                            {Object.entries(slot.sources).map(([src, n]) => (
                              <div key={src} className="text-[10px] text-white/60">
                                {src === "mass_message" ? "Mass Msg" : src === "direct_message" ? "DM" : "Wall Post"}: {n}
                              </div>
                            ))}
                            {slot.creators.length > 0 && (
                              <div className="text-[10px] text-teal-400 mt-1">{slot.creators.join(", ")}</div>
                            )}
                          </div>
                        )}
                        {isGap && (
                          <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 glass-panel rounded-lg p-2 text-left">
                            <div className="text-[10px] text-red-400">No content sent</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

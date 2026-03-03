"use client";

import { useState, useCallback, useMemo } from "react";
import { ShiftBlock } from "./ShiftBlock";
import type { TimezoneOption } from "./ShiftScheduler";

type Shift = {
  id: string;
  creatorId: string;
  chatterEmail: string;
  chatterName: string | null;
  dayOfWeek: number;
  shiftType: string;
};

type Creator = {
  id: string;
  name: string | null;
  ofUsername: string | null;
  avatarUrl: string | null;
};

type Props = {
  shifts: Shift[];
  creators: Creator[];
  onAssign: (creatorId: string, chatterEmail: string, chatterName: string, dayOfWeek: number, shiftType: string) => Promise<void>;
  onMove: (shiftId: string, newCreatorId: string, newDayOfWeek: number, newShiftType: string) => Promise<void>;
  onRemove: (shiftId: string) => Promise<void>;
  timezone: TimezoneOption;
};

// Tue→Mon order (payment cycle)
const DAY_ORDER = [2, 3, 4, 5, 6, 0, 1]; // Tue, Wed, Thu, Fri, Sat, Sun, Mon
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHIFT_TYPES = ["morning", "afternoon", "night"] as const;
const SHIFT_LABELS: Record<string, string> = {
  morning: "AM",
  afternoon: "PM",
  night: "Night",
};

// UK shift start/end hours
const UK_SHIFT_HOURS: Record<string, [number, number]> = {
  morning: [7, 15],
  afternoon: [15, 23],
  night: [23, 7],
};

/** Convert a UK hour to target timezone hour (handles wrap) */
function convertHour(ukHour: number, offsetFromUK: number): number {
  return ((ukHour + offsetFromUK) % 24 + 24) % 24;
}

/** Get the current offset from UK for a timezone (accounts for DST) */
function getOffsetFromUK(tzValue: string): number {
  const now = new Date();
  const ukStr = now.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false });
  const targetStr = now.toLocaleString("en-GB", { timeZone: tzValue, hour: "numeric", hour12: false });
  const ukHour = parseInt(ukStr);
  const targetHour = parseInt(targetStr);
  let diff = targetHour - ukHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function SchedulerGrid({ shifts, creators, onAssign, onMove, onRemove, timezone }: Props) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Index shifts: key = `${creatorId}-${dayOfWeek}-${shiftType}`
  const shiftMap = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.creatorId}-${s.dayOfWeek}-${s.shiftType}`;
    const arr = shiftMap.get(key) || [];
    arr.push(s);
    shiftMap.set(key, arr);
  }

  const handleDragOver = useCallback((e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, creatorId: string, dayOfWeek: number, shiftType: string) => {
      e.preventDefault();
      setDragOverCell(null);

      try {
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;
        const data = JSON.parse(raw);

        if (data.type === "new") {
          await onAssign(creatorId, data.chatterEmail, data.chatterName, dayOfWeek, shiftType);
        } else if (data.type === "move") {
          await onMove(data.shiftId, creatorId, dayOfWeek, shiftType);
        }
      } catch {
        // silent
      }
    },
    [onAssign, onMove]
  );

  // Get today's day of week for highlighting
  const todayUK = new Date(
    new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })
  );
  const todayDow = todayUK.getDay();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[900px]">
        {/* Header row: day columns */}
        <thead>
          <tr>
            {/* Model column header */}
            <th className="sticky left-0 z-10 bg-[#0a0a0a] w-[140px] min-w-[140px] p-2 text-left">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Model
              </span>
            </th>
            {DAY_ORDER.map((dow) => (
              <th
                key={dow}
                className={`p-2 text-center min-w-[100px] ${
                  dow === todayDow ? "bg-white/5 rounded-t-xl" : ""
                }`}
              >
                <div className={`text-xs font-semibold ${dow === todayDow ? "text-[#5B9BD5]" : "text-white/50"}`}>
                  {DAY_LABELS[dow]}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {creators.map((creator) => (
            <tr key={creator.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
              {/* Model avatar + name (sticky left) */}
              <td className="sticky left-0 z-10 bg-[#0a0a0a] p-2 align-top">
                <div className="flex items-center gap-2.5 py-1">
                  {creator.avatarUrl ? (
                    <img
                      src={`/api/proxy-media?url=${encodeURIComponent(creator.avatarUrl)}`}
                      alt={creator.name || ""}
                      className="w-8 h-8 rounded-full border border-white/10 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50 border border-white/10 flex-shrink-0">
                      {creator.name ? creator.name.charAt(0) : "?"}
                    </div>
                  )}
                  <span className="text-xs font-medium text-white/70 truncate max-w-[80px]">
                    {creator.name || creator.ofUsername || "Unknown"}
                  </span>
                </div>
              </td>

              {/* Day cells — each contains 3 stacked shift slots */}
              {DAY_ORDER.map((dow) => (
                <td
                  key={`${creator.id}-${dow}`}
                  className={`p-1 align-top ${dow === todayDow ? "bg-white/[0.03]" : ""}`}
                >
                  <div className="flex flex-col gap-0.5">
                    {SHIFT_TYPES.map((st) => {
                      const cellKey = `${creator.id}-${dow}-${st}`;
                      const cellShifts = shiftMap.get(cellKey) || [];
                      const isOver = dragOverCell === cellKey;

                      return (
                        <div
                          key={cellKey}
                          onDragOver={(e) => handleDragOver(e, cellKey)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, creator.id, dow, st)}
                          className={`min-h-[28px] rounded-lg p-0.5 transition-all ${
                            isOver
                              ? "bg-[#5B9BD5]/15 border border-[#5B9BD5]/40 scale-[1.02]"
                              : cellShifts.length === 0
                              ? "border border-transparent hover:border-white/5"
                              : "border border-transparent"
                          }`}
                        >
                          {cellShifts.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {cellShifts.map((s) => (
                                <ShiftBlock
                                  key={s.id}
                                  shiftId={s.id}
                                  chatterEmail={s.chatterEmail}
                                  chatterName={s.chatterName || s.chatterEmail.split("@")[0]}
                                  creatorId={s.creatorId}
                                  dayOfWeek={s.dayOfWeek}
                                  shiftType={s.shiftType}
                                  onRemove={onRemove}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-[9px] text-white/10">
                                {SHIFT_LABELS[st]}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Shift time legend — all three timezones, selected one highlighted */}
      <ShiftTimeLegend timezone={timezone} />
    </div>
  );
}

/** Shows all 3 shift types with UK / PHT / PST times, selected TZ highlighted */
function ShiftTimeLegend({ timezone }: { timezone: TimezoneOption }) {
  const phtOffset = getOffsetFromUK("Asia/Manila");
  const pstOffset = getOffsetFromUK("America/Los_Angeles");

  return (
    <div className="mt-3 px-2 space-y-1.5">
      {SHIFT_TYPES.map((st) => {
        const [ukStart, ukEnd] = UK_SHIFT_HOURS[st];
        const phtStart = convertHour(ukStart, phtOffset);
        const phtEnd = convertHour(ukEnd, phtOffset);
        const pstStart = convertHour(ukStart, pstOffset);
        const pstEnd = convertHour(ukEnd, pstOffset);

        const isUK = timezone.value === "Europe/London";
        const isPHT = timezone.value === "Asia/Manila";
        const isPST = timezone.value === "America/Los_Angeles";

        return (
          <div key={st} className="flex items-center gap-3">
            <span className="text-[10px] font-medium text-white/50 w-10">{SHIFT_LABELS[st]}</span>
            <span className={`text-[10px] ${isUK ? "text-[#5B9BD5] font-semibold" : "text-white/30"}`}>
              {pad2(ukStart)}–{pad2(ukEnd)} UK
            </span>
            <span className="text-white/10">|</span>
            <span className={`text-[10px] ${isPHT ? "text-[#E8735A] font-semibold" : "text-white/30"}`}>
              {pad2(phtStart)}–{pad2(phtEnd)} PHT
            </span>
            <span className="text-white/10">|</span>
            <span className={`text-[10px] ${isPST ? "text-[#D4A843] font-semibold" : "text-white/30"}`}>
              {pad2(pstStart)}–{pad2(pstEnd)} PST
            </span>
          </div>
        );
      })}
    </div>
  );
}

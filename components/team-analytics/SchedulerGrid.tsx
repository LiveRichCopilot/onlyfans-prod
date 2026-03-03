"use client";

import { useState, useCallback } from "react";
import { ShiftBlock } from "./ShiftBlock";

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
const SHIFT_TIMES: Record<string, string> = {
  morning: "07–15",
  afternoon: "15–23",
  night: "23–07",
};

export function SchedulerGrid({ shifts, creators, onAssign, onMove, onRemove }: Props) {
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

      {/* Shift time legend */}
      <div className="flex items-center gap-4 mt-3 px-2">
        {SHIFT_TYPES.map((st) => (
          <span key={st} className="text-[10px] text-white/30">
            {SHIFT_LABELS[st]} = {SHIFT_TIMES[st]} UK
          </span>
        ))}
      </div>
    </div>
  );
}

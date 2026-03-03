"use client";

import { getChatterColor } from "./ShiftBlock";

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
};

const DAY_ORDER = [2, 3, 4, 5, 6, 0, 1];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHIFT_SECTIONS = [
  { key: "morning", label: "Morning", time: "07:00 – 15:00 UK", icon: "☀️" },
  { key: "afternoon", label: "Afternoon", time: "15:00 – 23:00 UK", icon: "🌤️" },
  { key: "night", label: "Night", time: "23:00 – 07:00 UK", icon: "🌙" },
] as const;

export function CalendarView({ shifts, creators }: Props) {
  // Map creator IDs to names
  const creatorMap = new Map(creators.map((c) => [c.id, c]));

  // Get today's UK day
  const ukNow = new Date(
    new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })
  );
  const todayDow = ukNow.getDay();

  return (
    <div className="space-y-6">
      {/* Day tabs */}
      <div className="flex items-center gap-1">
        {DAY_ORDER.map((dow) => (
          <div
            key={dow}
            className={`flex-1 text-center py-2 rounded-xl text-xs font-semibold transition ${
              dow === todayDow
                ? "bg-[#5B9BD5]/20 text-[#5B9BD5]"
                : "text-white/40"
            }`}
          >
            {DAY_LABELS[dow]}
          </div>
        ))}
      </div>

      {/* Shift sections */}
      {SHIFT_SECTIONS.map((section) => {
        // Group shifts for today by this shift type, organized by creator
        const sectionShifts = shifts.filter(
          (s) => s.dayOfWeek === todayDow && s.shiftType === section.key
        );

        // Group by creator
        const byCreator = new Map<string, Shift[]>();
        for (const s of sectionShifts) {
          const arr = byCreator.get(s.creatorId) || [];
          arr.push(s);
          byCreator.set(s.creatorId, arr);
        }

        return (
          <div key={section.key} className="glass-card rounded-2xl overflow-hidden">
            {/* Section header */}
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{section.icon}</span>
                <span className="text-sm font-semibold text-white/80">{section.label}</span>
              </div>
              <span className="text-[10px] text-white/30">{section.time}</span>
            </div>

            {/* Rows — one per creator that has shifts */}
            {byCreator.size > 0 ? (
              <div className="divide-y divide-white/5">
                {Array.from(byCreator.entries()).map(([creatorId, creatorShifts]) => {
                  const creator = creatorMap.get(creatorId);
                  return (
                    <div key={creatorId} className="flex items-center gap-3 px-4 py-2.5">
                      {/* Model avatar + name */}
                      <div className="flex items-center gap-2 w-[120px] flex-shrink-0">
                        {creator?.avatarUrl ? (
                          <img
                            src={`/api/proxy-media?url=${encodeURIComponent(creator.avatarUrl)}`}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/50">
                            {creator?.name?.charAt(0) || "?"}
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-white/60 truncate">
                          {creator?.name || creator?.ofUsername || "Unknown"}
                        </span>
                      </div>

                      {/* Chatter pills */}
                      <div className="flex items-center gap-1.5 flex-wrap flex-1">
                        {creatorShifts.map((s) => {
                          const color = getChatterColor(s.chatterEmail);
                          const name = s.chatterName || s.chatterEmail.split("@")[0];
                          return (
                            <span
                              key={s.id}
                              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: `${color}20`,
                                color: `${color}dd`,
                                borderLeft: `2px solid ${color}`,
                              }}
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-white/20">No assignments</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

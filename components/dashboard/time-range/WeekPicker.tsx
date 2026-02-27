"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TimeRange = { start: Date; end: Date; label: string };

type Props = {
    onSelect: (range: TimeRange) => void;
};

/** Get the start of the week containing `date`, where the week starts on `weekStartDay` (0=Sun). */
function getWeekStart(date: Date, weekStartDay: number): Date {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const daysBack = (dayOfWeek - weekStartDay + 7) % 7;
    d.setDate(d.getDate() - daysBack);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatShort(d: Date): string {
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export function WeekPicker({ onSelect }: Props) {
    const [weekStart, setWeekStart] = useState(2); // Tuesday
    const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc.

    const currentWeekStart = getWeekStart(new Date(), weekStart);
    const selectedWeekStart = new Date(currentWeekStart);
    selectedWeekStart.setDate(selectedWeekStart.getDate() + weekOffset * 7);
    const selectedWeekEnd = new Date(selectedWeekStart);
    selectedWeekEnd.setDate(selectedWeekEnd.getDate() + 6);
    selectedWeekEnd.setHours(23, 59, 59, 999);

    const applySelectedWeek = () => {
        const now = new Date();
        const end = selectedWeekEnd > now ? now : selectedWeekEnd;
        const label = `${formatShort(selectedWeekStart)} - ${formatShort(selectedWeekEnd)}`;
        onSelect({ start: selectedWeekStart, end, label });
    };

    const applyThisMonth = () => {
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const monthStart = new Date(ukNow.getFullYear(), ukNow.getMonth(), 1, 0, 0, 0, 0);
        // Convert UK midnight back to UTC
        const ukOffset = ukNow.getTime() - now.getTime();
        const monthStartUtc = new Date(monthStart.getTime() - ukOffset);
        const monthName = ukNow.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
        onSelect({ start: monthStartUtc, end: now, label: monthName });
    };

    const isCurrentWeek = weekOffset === 0;
    const rangeLabel = `${formatShort(selectedWeekStart)} - ${formatShort(selectedWeekEnd)}`;

    return (
        <div className="space-y-3">
            <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Week starts on</div>
                <div className="grid grid-cols-4 gap-1">
                    {WEEKDAYS.map((day, i) => (
                        <button
                            key={day}
                            onClick={() => { setWeekStart(i); setWeekOffset(0); }}
                            className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                weekStart === i
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                            }`}
                        >
                            {day.slice(0, 3)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Week navigation */}
            <div className="flex items-center justify-between bg-white/5 rounded-xl border border-white/10 px-2 py-1.5">
                <button
                    onClick={() => setWeekOffset(weekOffset - 1)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-white/70">{rangeLabel}</span>
                <button
                    onClick={() => setWeekOffset(weekOffset + 1)}
                    disabled={isCurrentWeek}
                    className={`p-1.5 rounded-lg transition-colors ${
                        isCurrentWeek
                            ? "text-white/20 cursor-not-allowed"
                            : "hover:bg-white/10 text-white/60 hover:text-white"
                    }`}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={applySelectedWeek}
                    className="py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold transition-colors active:scale-95"
                >
                    {isCurrentWeek ? "This Week" : "Show Week"}
                </button>
                <button
                    onClick={applyThisMonth}
                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white text-sm font-semibold transition-colors active:scale-95"
                >
                    This Month
                </button>
            </div>
        </div>
    );
}

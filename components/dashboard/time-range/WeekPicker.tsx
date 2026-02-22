"use client";

import { useState } from "react";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TimeRange = { start: Date; end: Date; label: string };

type Props = {
    onSelect: (range: TimeRange) => void;
};

export function WeekPicker({ onSelect }: Props) {
    const [weekStart, setWeekStart] = useState(2); // Tuesday

    const applyThisWeek = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysBack = (dayOfWeek - weekStart + 7) % 7;
        const weekStartDate = new Date(now);
        weekStartDate.setDate(now.getDate() - daysBack);
        weekStartDate.setHours(0, 0, 0, 0);
        onSelect({ start: weekStartDate, end: now, label: `This week (from ${WEEKDAYS[weekStart]})` });
    };

    return (
        <div className="space-y-3">
            <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Week starts on</div>
                <div className="grid grid-cols-4 gap-1">
                    {WEEKDAYS.map((day, i) => (
                        <button
                            key={day}
                            onClick={() => setWeekStart(i)}
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
            <button
                onClick={applyThisWeek}
                className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold transition-colors active:scale-95"
            >
                Show This Week (from {WEEKDAYS[weekStart]})
            </button>
        </div>
    );
}

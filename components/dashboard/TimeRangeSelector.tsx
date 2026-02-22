"use client";

import { useState } from "react";
import { Clock, ChevronDown } from "lucide-react";

// Timezone offsets from UTC in hours
const TIMEZONES = {
    "LA": { label: "LA (PST)", offset: -8 },
    "FL": { label: "FL (EST)", offset: -5 },
    "PH": { label: "PH (PHT)", offset: 8 },
    "UK": { label: "UK (GMT)", offset: 0 },
};

// Preset quick ranges
const PRESETS = [
    { label: "20 min", value: "20m", ms: 20 * 60 * 1000 },
    { label: "1 hour", value: "1h", ms: 60 * 60 * 1000 },
    { label: "12 hours", value: "12h", ms: 12 * 60 * 60 * 1000 },
    { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
    { label: "7 days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];

// 3 shifts, 8 hours each — times shown are in the selected timezone
const SHIFTS = [
    { label: "Shift 1 — Day", value: "shift1", startHour: 8, endHour: 16, desc: "8 AM – 4 PM" },
    { label: "Shift 2 — Swing", value: "shift2", startHour: 16, endHour: 24, desc: "4 PM – 12 AM" },
    { label: "Shift 3 — Night", value: "shift3", startHour: 0, endHour: 8, desc: "12 AM – 8 AM" },
];

// Days of the week for custom week start
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type TimeRange = {
    start: Date;
    end: Date;
    label: string;
};

type Props = {
    onChange: (range: TimeRange) => void;
    currentRange: TimeRange | null;
};

export function TimeRangeSelector({ onChange, currentRange }: Props) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"quick" | "shift" | "week">("quick");
    const [timezone, setTimezone] = useState<keyof typeof TIMEZONES>("LA");
    const [weekStart, setWeekStart] = useState(2); // Tuesday = 2
    const [customShiftStart, setCustomShiftStart] = useState("08:00");
    const [customShiftEnd, setCustomShiftEnd] = useState("16:00");

    const applyPreset = (preset: typeof PRESETS[0]) => {
        const end = new Date();
        const start = new Date(end.getTime() - preset.ms);
        onChange({ start, end, label: `Last ${preset.label}` });
        setOpen(false);
    };

    const applyShift = (shift: typeof SHIFTS[0]) => {
        const now = new Date();
        const tz = TIMEZONES[timezone];
        // Get today's date in the selected timezone
        const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
        const tzNow = new Date(utcNow + tz.offset * 3600000);
        const todayStr = tzNow.toISOString().split("T")[0];

        const start = new Date(`${todayStr}T${String(shift.startHour).padStart(2, "0")}:00:00`);
        const end = new Date(`${todayStr}T${String(shift.endHour === 24 ? 23 : shift.endHour).padStart(2, "0")}:${shift.endHour === 24 ? "59:59" : "00:00"}`);

        // Adjust back to UTC from timezone
        start.setTime(start.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);
        end.setTime(end.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);

        onChange({ start, end, label: `${shift.desc} (${tz.label})` });
        setOpen(false);
    };

    const applyCustomShift = () => {
        const now = new Date();
        const tz = TIMEZONES[timezone];
        const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
        const tzNow = new Date(utcNow + tz.offset * 3600000);
        const todayStr = tzNow.toISOString().split("T")[0];

        const start = new Date(`${todayStr}T${customShiftStart}:00`);
        const end = new Date(`${todayStr}T${customShiftEnd}:00`);

        start.setTime(start.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);
        end.setTime(end.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);

        onChange({ start, end, label: `${customShiftStart} - ${customShiftEnd} (${tz.label})` });
        setOpen(false);
    };

    const applyThisWeek = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysBack = (dayOfWeek - weekStart + 7) % 7;
        const weekStartDate = new Date(now);
        weekStartDate.setDate(now.getDate() - daysBack);
        weekStartDate.setHours(0, 0, 0, 0);

        onChange({ start: weekStartDate, end: now, label: `This week (${WEEKDAYS[weekStart]} - ${WEEKDAYS[weekStart]})` });
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="glass-button px-4 py-2 rounded-xl text-sm flex items-center gap-2 text-white/80 border border-white/10 hover:border-teal-500/30 transition-colors"
            >
                <Clock size={14} className="text-teal-400" />
                <span>{currentRange?.label || "Today"}</span>
                <ChevronDown size={14} className="text-white/40" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 z-40 glass-panel rounded-2xl border border-white/10 shadow-2xl bg-gray-900/95 backdrop-blur-xl overflow-hidden">

                        {/* Timezone Picker */}
                        <div className="flex gap-1 p-3 border-b border-white/10 bg-black/20">
                            {(Object.keys(TIMEZONES) as Array<keyof typeof TIMEZONES>).map((tz) => (
                                <button
                                    key={tz}
                                    onClick={() => setTimezone(tz)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${timezone === tz ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "text-white/50 hover:bg-white/5"}`}
                                >
                                    {TIMEZONES[tz].label}
                                </button>
                            ))}
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/10">
                            {[
                                { key: "quick" as const, label: "Quick" },
                                { key: "shift" as const, label: "Shifts" },
                                { key: "week" as const, label: "Week" },
                            ].map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key)}
                                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === t.key ? "text-teal-400 border-b-2 border-teal-400" : "text-white/40 hover:text-white/60"}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-3">
                            {/* Quick Presets */}
                            {tab === "quick" && (
                                <div className="grid grid-cols-3 gap-2">
                                    {PRESETS.map((p) => (
                                        <button
                                            key={p.value}
                                            onClick={() => applyPreset(p)}
                                            className="py-2.5 rounded-xl text-sm font-medium text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const now = new Date();
                                            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                            onChange({ start: todayStart, end: now, label: "Today" });
                                            setOpen(false);
                                        }}
                                        className="py-2.5 rounded-xl text-sm font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                                    >
                                        Today
                                    </button>
                                </div>
                            )}

                            {/* Shift Presets */}
                            {tab === "shift" && (
                                <div className="space-y-2">
                                    {SHIFTS.map((s) => (
                                        <button
                                            key={s.value}
                                            onClick={() => applyShift(s)}
                                            className="w-full flex justify-between items-center py-3 px-4 rounded-xl text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                        >
                                            <span className="font-medium text-white/80">{s.label}</span>
                                            <span className="text-white/40 text-xs">{s.desc}</span>
                                        </button>
                                    ))}

                                    {/* Custom Shift */}
                                    <div className="pt-2 border-t border-white/10 mt-2">
                                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Custom Shift</div>
                                        <div className="flex items-center gap-2">
                                            <input type="time" value={customShiftStart} onChange={(e) => setCustomShiftStart(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
                                            <span className="text-white/30 text-xs">to</span>
                                            <input type="time" value={customShiftEnd} onChange={(e) => setCustomShiftEnd(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
                                        </div>
                                        <button
                                            onClick={applyCustomShift}
                                            className="w-full mt-2 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors active:scale-95"
                                        >
                                            Apply Shift
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Week Picker */}
                            {tab === "week" && (
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Week starts on</div>
                                        <div className="grid grid-cols-4 gap-1">
                                            {WEEKDAYS.map((day, i) => (
                                                <button
                                                    key={day}
                                                    onClick={() => setWeekStart(i)}
                                                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${weekStart === i ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}
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
                                        Show This Week ({WEEKDAYS[weekStart]} - {WEEKDAYS[weekStart]})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import { TIMEZONES } from "./TimezoneBar";

const SHIFTS = [
    { label: "Shift 1 — Day", value: "shift1", startHour: 8, endHour: 16, desc: "8 AM – 4 PM" },
    { label: "Shift 2 — Swing", value: "shift2", startHour: 16, endHour: 24, desc: "4 PM – 12 AM" },
    { label: "Shift 3 — Night", value: "shift3", startHour: 0, endHour: 8, desc: "12 AM – 8 AM" },
];

type TimeRange = { start: Date; end: Date; label: string };

type Props = {
    timezone: keyof typeof TIMEZONES;
    onSelect: (range: TimeRange) => void;
};

export function ShiftPresets({ timezone, onSelect }: Props) {
    const [customStart, setCustomStart] = useState("08:00");
    const [customEnd, setCustomEnd] = useState("16:00");
    const tz = TIMEZONES[timezone];

    const applyShift = (shift: (typeof SHIFTS)[0]) => {
        const now = new Date();
        const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
        const tzNow = new Date(utcNow + tz.offset * 3600000);
        const todayStr = tzNow.toISOString().split("T")[0];

        const start = new Date(`${todayStr}T${String(shift.startHour).padStart(2, "0")}:00:00`);
        const end = new Date(`${todayStr}T${String(shift.endHour === 24 ? 23 : shift.endHour).padStart(2, "0")}:${shift.endHour === 24 ? "59:59" : "00:00"}`);

        start.setTime(start.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);
        end.setTime(end.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);

        onSelect({ start, end, label: `${shift.desc} (${tz.label})` });
    };

    const applyCustom = () => {
        const now = new Date();
        const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
        const tzNow = new Date(utcNow + tz.offset * 3600000);
        const todayStr = tzNow.toISOString().split("T")[0];

        const start = new Date(`${todayStr}T${customStart}:00`);
        const end = new Date(`${todayStr}T${customEnd}:00`);

        start.setTime(start.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);
        end.setTime(end.getTime() - tz.offset * 3600000 - now.getTimezoneOffset() * 60000);

        onSelect({ start, end, label: `${customStart} - ${customEnd} (${tz.label})` });
    };

    return (
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

            <div className="pt-2 border-t border-white/10 mt-2">
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-semibold">Custom Shift</div>
                <div className="flex items-center gap-2">
                    <input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
                    <span className="text-white/30 text-xs">to</span>
                    <input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
                </div>
                <button onClick={applyCustom} className="w-full mt-2 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors active:scale-95">
                    Apply Shift
                </button>
            </div>
        </div>
    );
}

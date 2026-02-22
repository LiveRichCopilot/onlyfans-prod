"use client";

import { useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { TimezoneBar } from "./time-range/TimezoneBar";
import { RangeTabs } from "./time-range/RangeTabs";
import { QuickPresets } from "./time-range/QuickPresets";
import { ShiftPresets } from "./time-range/ShiftPresets";
import { WeekPicker } from "./time-range/WeekPicker";

type TimeRange = { start: Date; end: Date; label: string };

type Props = {
    onChange: (range: TimeRange) => void;
    currentRange: TimeRange | null;
};

export function TimeRangeSelector({ onChange, currentRange }: Props) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"quick" | "shift" | "week">("quick");
    const [timezone, setTimezone] = useState<string>("LA");

    const handleSelect = (range: TimeRange) => {
        onChange(range);
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
                        <TimezoneBar selected={timezone} onSelect={setTimezone} />
                        <RangeTabs active={tab} onSelect={setTab} />
                        <div className="p-3">
                            {tab === "quick" && <QuickPresets onSelect={handleSelect} />}
                            {tab === "shift" && <ShiftPresets timezone={timezone as any} onSelect={handleSelect} />}
                            {tab === "week" && <WeekPicker onSelect={handleSelect} />}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

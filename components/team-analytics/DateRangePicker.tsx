"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, Clock, ChevronDown } from "lucide-react";

export type DateRange = {
  startDate: string; // ISO string
  endDate: string;   // ISO string
  label: string;     // e.g. "7d", "Today", "Feb 19 – Feb 26"
  days: number;      // approximate days for backward compat
};

type Preset = {
  label: string;
  icon?: "clock" | "calendar";
  getRange: () => { start: Date; end: Date; days: number };
};

function ukNow(): Date {
  // UK time — use UTC offset approach
  return new Date();
}

function startOfDayUK(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeekUK(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const PRESETS: Preset[] = [
  {
    label: "This Hour",
    icon: "clock",
    getRange: () => {
      const now = ukNow();
      const start = new Date(now.getTime() - 60 * 60 * 1000);
      return { start, end: now, days: 0 };
    },
  },
  {
    label: "Today",
    getRange: () => {
      const now = ukNow();
      return { start: startOfDayUK(now), end: now, days: 1 };
    },
  },
  {
    label: "Yesterday",
    getRange: () => {
      const now = ukNow();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: startOfDayUK(yesterday), end: startOfDayUK(now), days: 1 };
    },
  },
  {
    label: "This Week",
    getRange: () => {
      const now = ukNow();
      return { start: startOfWeekUK(now), end: now, days: 7 };
    },
  },
  {
    label: "7d",
    getRange: () => {
      const now = ukNow();
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now, days: 7 };
    },
  },
  {
    label: "14d",
    getRange: () => {
      const now = ukNow();
      return { start: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), end: now, days: 14 };
    },
  },
  {
    label: "30d",
    getRange: () => {
      const now = ukNow();
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now, days: 30 };
    },
  },
  {
    label: "90d",
    getRange: () => {
      const now = ukNow();
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now, days: 90 };
    },
  },
];

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectPreset = (preset: Preset) => {
    const { start, end, days } = preset.getRange();
    onChange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: preset.label,
      days,
    });
    setShowCustom(false);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart + "T00:00:00");
    const end = new Date(customEnd + "T23:59:59");
    if (end <= start) return;
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    onChange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: `${fmtShortDate(start)} – ${fmtShortDate(end)}`,
      days: diffDays,
    });
    setOpen(false);
  };

  return (
    <div ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="glass-button rounded-xl px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white flex items-center gap-1.5 transition"
      >
        <Calendar size={12} className="text-teal-400" />
        <span>{value.label}</span>
        <ChevronDown size={11} className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Inline panel — pushes content down, not a floating overlay */}
      {open && (
        <div className="mt-2 w-72 rounded-2xl p-3 border border-white/10 space-y-2" style={{ background: "#454445" }}>
          {/* Preset grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => selectPreset(p)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition flex items-center justify-center gap-1 ${
                  value.label === p.label
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {p.icon === "clock" && <Clock size={10} />}
                {p.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Custom date range */}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white flex items-center gap-1.5 transition bg-white/5 hover:bg-white/10"
          >
            <Calendar size={10} className="text-teal-400" />
            Custom Range
            <ChevronDown size={10} className={`ml-auto text-white/30 transition-transform ${showCustom ? "rotate-180" : ""}`} />
          </button>

          {showCustom && (
            <div className="space-y-2 px-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    max={toInputDate(new Date())}
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg text-white text-[11px] border border-white/10 [color-scheme:dark]"
                    style={{ background: "#333" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    max={toInputDate(new Date())}
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg text-white text-[11px] border border-white/10 [color-scheme:dark]"
                    style={{ background: "#333" }}
                  />
                </div>
              </div>
              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd}
                className="w-full py-1.5 rounded-lg text-[11px] font-semibold transition bg-white/15 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Apply Range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

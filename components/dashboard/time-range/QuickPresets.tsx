"use client";

const PRESETS = [
    { label: "20 min", value: "20m", ms: 20 * 60 * 1000 },
    { label: "1 hour", value: "1h", ms: 60 * 60 * 1000 },
    { label: "12 hours", value: "12h", ms: 12 * 60 * 60 * 1000 },
    { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
    { label: "7 days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];

type TimeRange = { start: Date; end: Date; label: string };

type Props = {
    onSelect: (range: TimeRange) => void;
};

/** Build a UK-day range: 00:00:00 to 23:59:59 for a given date */
function ukDayRange(year: number, month: number, day: number): { start: Date; end: Date } {
    // Create dates in UK timezone, then convert back to UTC
    const ukStart = new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+00:00`);
    const ukEnd = new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59+00:00`);
    // Approximate UK offset by comparing local interpretation
    const nowUtc = new Date();
    const ukNow = new Date(nowUtc.toLocaleString("en-US", { timeZone: "Europe/London" }));
    const ukOffsetMs = ukNow.getTime() - nowUtc.getTime();
    return {
        start: new Date(ukStart.getTime() - ukOffsetMs),
        end: new Date(ukEnd.getTime() - ukOffsetMs),
    };
}

export function QuickPresets({ onSelect }: Props) {
    const applyPreset = (preset: (typeof PRESETS)[0]) => {
        const end = new Date();
        const start = new Date(end.getTime() - preset.ms);
        onSelect({ start, end, label: `Last ${preset.label}` });
    };

    const applyToday = () => {
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const range = ukDayRange(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate());
        onSelect({ start: range.start, end: now, label: "Today" });
    };

    const applyYesterday = () => {
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const yesterday = new Date(ukNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const range = ukDayRange(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        onSelect({ start: range.start, end: range.end, label: "Yesterday" });
    };

    const applyDate = (dateStr: string) => {
        if (!dateStr) return;
        const [y, m, d] = dateStr.split("-").map(Number);
        const range = ukDayRange(y, m - 1, d);
        // Format a readable label
        const dt = new Date(y, m - 1, d);
        const label = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        onSelect({ start: range.start, end: range.end, label });
    };

    return (
        <div className="space-y-2">
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
                    onClick={applyToday}
                    className="py-2.5 rounded-xl text-sm font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                >
                    Today
                </button>
                <button
                    onClick={applyYesterday}
                    className="py-2.5 rounded-xl text-sm font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                >
                    Yesterday
                </button>
            </div>
            <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 font-semibold">Jump to date</div>
                <input
                    type="date"
                    onChange={(e) => applyDate(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl text-sm text-white/80 bg-white/5 border border-white/10 hover:border-teal-500/30 focus:border-teal-500/40 focus:outline-none transition-colors [color-scheme:dark]"
                />
            </div>
        </div>
    );
}

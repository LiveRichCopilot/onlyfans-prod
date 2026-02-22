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

export function QuickPresets({ onSelect }: Props) {
    const applyPreset = (preset: (typeof PRESETS)[0]) => {
        const end = new Date();
        const start = new Date(end.getTime() - preset.ms);
        onSelect({ start, end, label: `Last ${preset.label}` });
    };

    const applyToday = () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        onSelect({ start: todayStart, end: now, label: "Today" });
    };

    return (
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
        </div>
    );
}

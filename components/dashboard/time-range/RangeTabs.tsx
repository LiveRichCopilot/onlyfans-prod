"use client";

type Tab = "quick" | "shift" | "week";

type Props = {
    active: Tab;
    onSelect: (tab: Tab) => void;
};

const TABS: { key: Tab; label: string }[] = [
    { key: "quick", label: "Quick" },
    { key: "shift", label: "Shifts" },
    { key: "week", label: "Week" },
];

export function RangeTabs({ active, onSelect }: Props) {
    return (
        <div className="flex border-b border-white/10">
            {TABS.map((t) => (
                <button
                    key={t.key}
                    onClick={() => onSelect(t.key)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                        active === t.key
                            ? "text-teal-400 border-b-2 border-teal-400"
                            : "text-white/40 hover:text-white/60"
                    }`}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

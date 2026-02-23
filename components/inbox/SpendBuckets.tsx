"use client";

type Bucket = {
    label: string;
    minSpend: number;
    maxSpend?: number;
    color: string;
};

const BUCKETS: Bucket[] = [
    { label: "All", minSpend: 0, color: "#94A3B8" },
    { label: "$50+", minSpend: 50, color: "#f59e0b" },
    { label: "$100+", minSpend: 100, color: "#ef4444" },
    { label: "$500+", minSpend: 500, color: "#86efac" },
    { label: "$1K+", minSpend: 1000, color: "#22c55e" },
    { label: "$5K+", minSpend: 5000, color: "#00ff88" },
];

type Props = {
    activeBucket: number; // minSpend value of active bucket (0 = all)
    onBucketChange: (minSpend: number) => void;
    onlineOnly: boolean;
    onOnlineToggle: () => void;
};

export function SpendBuckets({ activeBucket, onBucketChange, onlineOnly, onOnlineToggle }: Props) {
    return (
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar">
            {BUCKETS.map(b => {
                const isActive = activeBucket === b.minSpend;
                return (
                    <button
                        key={b.minSpend}
                        onClick={() => onBucketChange(b.minSpend)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all ${
                            isActive
                                ? "border-opacity-40"
                                : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:bg-white/[0.06]"
                        }`}
                        style={isActive ? {
                            color: b.color,
                            borderColor: b.color + "40",
                            backgroundColor: b.color + "15",
                        } : undefined}
                    >
                        {b.label}
                    </button>
                );
            })}

            {/* Online toggle */}
            <div className="w-px h-4 bg-white/[0.08] mx-0.5 flex-shrink-0" />
            <button
                onClick={onOnlineToggle}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all ${
                    onlineOnly
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:bg-white/[0.06]"
                }`}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${onlineOnly ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-white/20"}`} />
                Online
            </button>
        </div>
    );
}

export { BUCKETS };

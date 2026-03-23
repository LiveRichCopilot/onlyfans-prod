"use client";

import { useLanguage } from "@/lib/LanguageContext";

type Bucket = {
    label: string;
    minSpend: number;
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
    activeBucket: number;
    onBucketChange: (minSpend: number) => void;
    onlineOnly: boolean;
    onOnlineToggle: () => void;
};

export function SpendBuckets({ activeBucket, onBucketChange, onlineOnly, onOnlineToggle }: Props) {
    const { t } = useLanguage();
    const active = BUCKETS.find((b) => b.minSpend === activeBucket) ?? BUCKETS[0];
    return (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-xs font-medium text-white/50 shrink-0">{t("minSpendFilter")}:</span>
            <select
                value={activeBucket}
                onChange={(e) => onBucketChange(Number(e.target.value))}
                className="bg-white/[0.06] text-sm text-white rounded-xl px-3 py-2 outline-none border border-white/[0.08] focus:border-teal-500/50 transition-colors appearance-none cursor-pointer min-w-0 flex-1"
                style={{
                    color: active.color,
                }}
            >
                {BUCKETS.map((b) => (
                    <option key={b.minSpend} value={b.minSpend} className="bg-[#1a1a1a] text-white">
                        {b.minSpend === 0 ? t("all") : b.label}
                    </option>
                ))}
            </select>
            <button
                onClick={onOnlineToggle}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                    onlineOnly
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-white/[0.06] text-white/50 border-white/[0.08] hover:bg-white/[0.08]"
                }`}
            >
                <div className={`w-2 h-2 rounded-full ${onlineOnly ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-white/20"}`} />
                {t("online")}
            </button>
        </div>
    );
}

export { BUCKETS };

"use client";

import { useState, useEffect, useRef } from "react";

type CreatorHourly = {
    id: string;
    name: string;
    avatarUrl: string | null;
    hourlyTarget: number;
    hourly: number[];
    total: number;
};

type HourlyData = {
    currentHour: number;
    creators: CreatorHourly[];
};

function cellColor(amount: number, target: number) {
    if (amount === 0) return "text-white/20";
    if (amount >= target * 2) return "text-amber-400 bg-amber-500/10";
    if (amount >= target) return "text-teal-400 bg-teal-500/10";
    return "text-white/70";
}

function formatHour(hour: number) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "a" : "p";
    return `${h}${ampm}`;
}

export function HourlyModelCounter() {
    const [data, setData] = useState<HourlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        function fetchData() {
            fetch("/api/creators/hourly-breakdown")
                .then((res) => res.json())
                .then((d) => { setData(d); setLoading(false); })
                .catch((err) => { console.error("Hourly fetch error:", err); setLoading(false); });
        }

        fetchData();
        intervalRef.current = setInterval(fetchData, 60000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    if (loading) {
        return (
            <div className="glass-panel rounded-3xl border-t border-t-white/20 border-l border-l-white/10 p-6 animate-pulse">
                <div className="h-5 w-56 bg-white/10 rounded mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 bg-white/5 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!data || data.creators.length === 0) {
        return null;
    }

    const hours = Array.from({ length: data.currentHour + 1 }, (_, i) => i);

    return (
        <div className="glass-panel rounded-3xl border-t border-t-white/20 border-l border-l-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white/80">Hourly Breakdown</h3>
                <span className="text-[10px] text-white/30 font-mono">UK time</span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left text-white/40 text-xs font-medium pb-2 pr-4 sticky left-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-10 min-w-[140px]">
                                Model
                            </th>
                            {hours.map((h) => (
                                <th key={h} className="text-center text-white/30 text-[10px] font-mono pb-2 px-1 min-w-[52px]">
                                    {formatHour(h)}
                                </th>
                            ))}
                            <th className="text-right text-white/40 text-xs font-medium pb-2 pl-4 sticky right-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-10 min-w-[80px]">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.creators.map((creator) => (
                            <tr key={creator.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="py-2.5 pr-4 sticky left-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-10">
                                    <div className="flex items-center gap-2.5">
                                        {creator.avatarUrl ? (
                                            <img
                                                src={`/api/proxy-media?url=${encodeURIComponent(creator.avatarUrl)}`}
                                                alt={creator.name}
                                                className="w-7 h-7 rounded-full object-cover border border-white/10"
                                            />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold border border-white/10">
                                                {creator.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-white/80 font-medium text-xs truncate max-w-[100px]">
                                            {creator.name}
                                        </span>
                                    </div>
                                </td>
                                {creator.hourly.map((amount, i) => (
                                    <td key={i} className={`text-center py-2.5 px-1 text-xs font-mono rounded ${cellColor(amount, creator.hourlyTarget)}`}>
                                        {amount > 0 ? `$${amount.toFixed(0)}` : "-"}
                                    </td>
                                ))}
                                <td className="text-right py-2.5 pl-4 sticky right-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-10">
                                    <span className="text-white font-semibold text-sm">
                                        ${creator.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

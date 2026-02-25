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

function cellStyle(amount: number, target: number) {
    if (amount === 0) return "text-white/15";
    if (amount >= target * 2) return "text-amber-400 bg-amber-500/10 border border-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.08)]";
    if (amount >= target) return "text-teal-400 bg-teal-500/10 border border-teal-500/15 shadow-[0_0_12px_rgba(13,148,136,0.08)]";
    return "text-white/60 bg-white/[0.02]";
}

function formatHour(hour: number) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "a" : "p";
    return `${h}${ampm}`;
}

// Frosted sticky column style — matches liquid glass layering
const stickyCol = "backdrop-blur-[40px] bg-[rgba(5,5,8,0.75)]";

export function HourlyModelCounter() {
    const [data, setData] = useState<HourlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        function fetchData() {
            fetch("/api/creators/hourly-breakdown")
                .then((res) => {
                    if (!res.ok) throw new Error(`API ${res.status}`);
                    return res.json();
                })
                .then((d) => {
                    if (d.error) throw new Error(d.error);
                    setData(d);
                    setError(null);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Hourly fetch error:", err);
                    setError(err.message);
                    setLoading(false);
                });
        }

        fetchData();
        intervalRef.current = setInterval(fetchData, 60000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // --- Loading skeleton ---
    if (loading) {
        return (
            <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6 animate-pulse">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-1.5 h-5 rounded-full bg-teal-500/30" />
                    <div className="h-5 w-48 bg-white/8 rounded-lg" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-white/[0.03] rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    // --- Error state ---
    if (error) {
        return (
            <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-1.5 h-5 rounded-full bg-red-500/50" />
                    <h3 className="text-lg font-semibold text-white/85 tracking-tight">Hourly Breakdown</h3>
                </div>
                <p className="text-sm text-red-400/70">Failed to load hourly data: {error}</p>
            </div>
        );
    }

    // --- Empty state (show the panel so user knows the feature exists) ---
    if (!data || data.creators.length === 0) {
        return (
            <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-teal-400 to-teal-600 shadow-[0_0_8px_rgba(13,148,136,0.3)]" />
                    <h3 className="text-lg font-semibold text-white/85 tracking-tight">Hourly Breakdown</h3>
                </div>
                <p className="text-sm text-white/30">No hourly data yet today. Revenue will appear here as transactions come in.</p>
            </div>
        );
    }

    const hours = Array.from({ length: data.currentHour + 1 }, (_, i) => i);

    return (
        <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6">
            {/* Header with specular top edge */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-teal-400 to-teal-600 shadow-[0_0_8px_rgba(13,148,136,0.3)]" />
                    <h3 className="text-lg font-semibold text-white/85 tracking-tight">Hourly Breakdown</h3>
                </div>
                <div className="glass-inset px-3 py-1 rounded-xl">
                    <span className="text-[10px] text-white/40 font-mono tracking-wider">UK TIME</span>
                </div>
            </div>

            {/* Table with frosted scroll */}
            <div className="overflow-x-auto custom-scrollbar rounded-2xl glass-inset p-1">
                <table className="w-full text-sm border-separate border-spacing-y-1">
                    <thead>
                        <tr>
                            <th className={`text-left text-white/35 text-[10px] font-semibold uppercase tracking-wider pb-2 px-3 sticky left-0 z-10 min-w-[140px] ${stickyCol}`}>
                                Model
                            </th>
                            {hours.map((h) => (
                                <th key={h} className="text-center text-white/25 text-[10px] font-mono pb-2 px-1 min-w-[52px]">
                                    {formatHour(h)}
                                </th>
                            ))}
                            <th className={`text-right text-white/35 text-[10px] font-semibold uppercase tracking-wider pb-2 px-3 sticky right-0 z-10 min-w-[80px] ${stickyCol}`}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.creators.map((creator) => (
                            <tr key={creator.id} className="group">
                                {/* Sticky model column */}
                                <td className={`py-2.5 px-3 sticky left-0 z-10 rounded-l-xl ${stickyCol} group-hover:bg-white/[0.03] transition-colors`}>
                                    <div className="flex items-center gap-2.5">
                                        {creator.avatarUrl ? (
                                            <img
                                                src={`/api/proxy-media?url=${encodeURIComponent(creator.avatarUrl)}`}
                                                alt={creator.name}
                                                className="w-7 h-7 rounded-full object-cover border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                                            />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-[10px] font-bold border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                                                {creator.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-white/75 font-medium text-xs truncate max-w-[100px]">
                                            {creator.name}
                                        </span>
                                    </div>
                                </td>
                                {/* Hourly cells */}
                                {creator.hourly.map((amount, i) => (
                                    <td key={i} className={`text-center py-2.5 px-1 text-xs font-mono rounded-lg transition-all ${cellStyle(amount, creator.hourlyTarget)}`}>
                                        {amount > 0 ? `$${amount.toFixed(0)}` : "\u2013"}
                                    </td>
                                ))}
                                {/* Sticky total column */}
                                <td className={`text-right py-2.5 px-3 sticky right-0 z-10 rounded-r-xl ${stickyCol} group-hover:bg-white/[0.03] transition-colors`}>
                                    <span className="text-white/90 font-semibold text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
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

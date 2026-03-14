"use client";

import { useState, useEffect, useMemo } from "react";
import { NavBar } from "@/components/inbox/NavBar";

type PerformanceRecord = {
    id: string;
    userId: string;
    creatorId: string;
    liveScore: number;
    dailyEarned: number;
    ppvUnlocks: number;
    robotPhraseCount: number;
    creativePhraseCount: number;
    conversationsHandled: number;
    avgResponseTime: number | null;
    userName: string;
    userImage: string | null;
    creatorName: string;
    creatorAvatar: string | null;
};

export default function PerformancePage() {
    const [records, setRecords] = useState<PerformanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [modelFilter, setModelFilter] = useState<string>("all");

    useEffect(() => {
        fetch("/api/inbox/performance")
            .then((r) => r.json())
            .then((data) => {
                setRecords(data.performance || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));

        // Auto-refresh every 2 minutes
        const interval = setInterval(() => {
            fetch("/api/inbox/performance")
                .then((r) => r.json())
                .then((data) => {
                    if (data.performance) setRecords(data.performance);
                })
                .catch(console.error);
        }, 120000);

        return () => clearInterval(interval);
    }, []);

    const creatorList = useMemo(() => {
        const map = new Map<string, string>();
        records.forEach((r) => map.set(r.creatorId, r.creatorName));
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [records]);

    const filteredRecords = useMemo(() => {
        if (modelFilter === "all") return records;
        return records.filter((r) => r.creatorId === modelFilter);
    }, [records, modelFilter]);

    const scoreColor = (score: number) => {
        if (score >= 80) return "text-emerald-400";
        if (score >= 50) return "text-amber-400";
        return "text-red-400";
    };

    const scoreBg = (score: number) => {
        if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
        if (score >= 50) return "bg-amber-500/10 border-amber-500/20";
        return "bg-red-500/10 border-red-500/20";
    };

    return (
        <div className="flex h-screen text-white/90 overflow-hidden" style={{ backgroundColor: "#2d2d2d" }}>
            <div className="hidden md:block">
                <NavBar />
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-white">Chatter Performance</h1>
                            <p className="text-white/40 text-xs sm:text-sm mt-1">
                                Live scores updated every 15 minutes
                            </p>
                        </div>
                        <div className="text-xs text-white/30 hidden sm:block">
                            {new Date().toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                        </div>
                    </div>

                    {/* Model Picker */}
                    {creatorList.length > 1 && (
                        <div className="mb-4">
                            <select
                                value={modelFilter}
                                onChange={(e) => setModelFilter(e.target.value)}
                                className="w-full rounded-xl px-4 py-3 text-base sm:text-sm font-medium text-white bg-white/[0.04] border border-white/10 outline-none cursor-pointer appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
                            >
                                <option value="all" className="bg-[#111]">All Models</option>
                                {creatorList.map(([id, name]) => (
                                    <option key={id} value={id} className="bg-[#111]">{name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
                            ))}
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-4xl mb-4">📊</div>
                            <h3 className="text-lg text-white/60 font-medium">No performance data yet</h3>
                            <p className="text-white/30 text-sm mt-2">
                                Scores will appear after chatters start working today
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredRecords.map((record, i) => (
                                <div
                                    key={record.id}
                                    className={`rounded-xl border p-4 ${scoreBg(record.liveScore)} transition-all hover:scale-[1.01]`}
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {/* Rank */}
                                        <div className="text-xl sm:text-2xl font-bold text-white/20 w-6 sm:w-8 text-center shrink-0">
                                            {i + 1}
                                        </div>

                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {record.userImage ? (
                                                <img src={record.userImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white/30 text-lg font-bold">
                                                    {(record.userName || "?")[0].toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Name + Creator */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-semibold truncate">
                                                {record.userName}
                                            </div>
                                            <div className="text-white/40 text-xs truncate">
                                                {record.creatorName}
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className={`text-2xl sm:text-3xl font-black shrink-0 ${scoreColor(record.liveScore)}`}>
                                            {record.liveScore}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 pl-8 sm:pl-12">
                                        <div className="text-center">
                                            <div className="text-white/80 text-sm font-semibold">
                                                ${record.dailyEarned.toFixed(0)}
                                            </div>
                                            <div className="text-white/30 text-[10px]">Earned</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-white/80 text-sm font-semibold">
                                                {record.ppvUnlocks}
                                            </div>
                                            <div className="text-white/30 text-[10px]">PPV Unlocks</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-white/80 text-sm font-semibold">
                                                {record.conversationsHandled}
                                            </div>
                                            <div className="text-white/30 text-[10px]">Chats</div>
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-sm font-semibold ${record.robotPhraseCount > 3 ? "text-red-400" : "text-white/80"}`}>
                                                {record.robotPhraseCount}
                                            </div>
                                            <div className="text-white/30 text-[10px]">Robot</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-emerald-400 text-sm font-semibold">
                                                {record.creativePhraseCount}
                                            </div>
                                            <div className="text-white/30 text-[10px]">Creative</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

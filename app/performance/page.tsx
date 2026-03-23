"use client";

import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Zap } from "lucide-react";

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
    const { t } = useLanguage();
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
        <div className="min-h-screen text-white/90 p-4 md:p-6">
            <header className="glass-panel rounded-2xl p-4 mb-4 border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-600/80 to-orange-700 flex items-center justify-center">
                            <Zap size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white/95">{t("chatterPerformance")}</h1>
                            <p className="text-xs sm:text-sm text-white/50 mt-0.5">{t("chatterPerformanceDesc")}</p>
                        </div>
                    </div>
                    <div className="text-xs text-white/40 hidden sm:block">
                        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </div>
                </div>
            </header>

            <div className="glass-panel rounded-3xl overflow-hidden border-white/10 flex flex-col min-h-[calc(100vh-12rem)]">
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                    {creatorList.length > 1 && (
                        <div className="mb-4">
                            <select
                                value={modelFilter}
                                onChange={(e) => setModelFilter(e.target.value)}
                                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white bg-white/5 border border-white/10 outline-none cursor-pointer focus:border-teal-500/50 transition-colors appearance-none pr-10"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                            >
                                <option value="all" className="bg-[#111]">{t("allModels")}</option>
                                {creatorList.map(([id, name]) => (
                                    <option key={id} value={id} className="bg-[#111]">{name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-24 rounded-xl glass-inset animate-pulse" />
                            ))}
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                                <Zap size={28} className="text-white/20" />
                            </div>
                            <h3 className="text-lg font-medium text-white/60">{t("noPerformanceData")}</h3>
                            <p className="text-sm text-white/40 mt-2 max-w-xs">{t("noPerformanceDataDesc")}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredRecords.map((record, i) => (
                                <div
                                    key={record.id}
                                    className={`glass-card rounded-2xl border p-4 ${scoreBg(record.liveScore)} transition-all hover:bg-white/[0.08]`}
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="text-xl sm:text-2xl font-bold text-white/20 w-6 sm:w-8 text-center shrink-0">
                                            {i + 1}
                                        </div>

                                        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {record.userImage ? (
                                                <img src={`/api/proxy-media?url=${encodeURIComponent(record.userImage)}`} alt="" className="w-full h-full object-cover" />
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

                                    <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 pl-8 sm:pl-12">
                                        <div className="text-center">
                                            <div className="text-white/80 text-sm font-semibold">${record.dailyEarned.toFixed(0)}</div>
                                            <div className="text-white/30 text-[10px]">{t("earned")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-white/80 text-sm font-semibold">{record.ppvUnlocks}</div>
                                            <div className="text-white/30 text-[10px]">{t("ppvUnlocks")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-white/80 text-sm font-semibold">{record.conversationsHandled}</div>
                                            <div className="text-white/30 text-[10px]">{t("chatsStat")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-sm font-semibold ${record.robotPhraseCount > 3 ? "text-red-400" : "text-white/80"}`}>
                                                {record.robotPhraseCount}
                                            </div>
                                            <div className="text-white/30 text-[10px]">{t("robot")}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-emerald-400 text-sm font-semibold">{record.creativePhraseCount}</div>
                                            <div className="text-white/30 text-[10px]">{t("creative")}</div>
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

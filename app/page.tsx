"use client";

import { Settings, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
// @ts-ignore: Next relies on Vercel install
import { startOnlyFansAuthentication } from "@onlyfansapi/auth";

import { emitOpenAddCreator } from "@/lib/emit-open-add-creator";
import { useLanguage } from "@/lib/LanguageContext";
import { CreatorCard } from "@/components/dashboard/CreatorCard";
import { ModulesGrid } from "@/components/dashboard/ModulesGrid";
import { TimeRangeSelector } from "@/components/dashboard/TimeRangeSelector";
import { HourlyModelCounter } from "@/components/dashboard/HourlyModelCounter";

type TimeRange = { start: Date; end: Date; label: string };

export default function AgencyDashboard() {
    const { t } = useLanguage();
    const [isAuthenticatingId, setIsAuthenticatingId] = useState<string | null>(null);
    const [creators, setCreators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange | null>(null);
    const [modelFilter, setModelFilter] = useState<string>("all");

    const fetchCreators = useCallback((range?: TimeRange) => {
        setLoading(true);
        let url = "/api/creators";
        if (range) {
            url += `?start=${range.start.toISOString()}&end=${range.end.toISOString()}`;
        }
        fetch(url)
            .then(res => res.json())
            .then(data => { setCreators(data.creators || []); setLoading(false); })
            .catch(err => { console.error("Failed to fetch creators", err); setLoading(false); });
    }, []);

    useEffect(() => { fetchCreators(); }, [fetchCreators]);

    const handleTimeRangeChange = (range: TimeRange) => {
        setTimeRange(range);
        fetchCreators(range);
    };

    const handleConnectOF = async (e: React.MouseEvent, c: any) => {
        e.preventDefault();
        setIsAuthenticatingId(c.id);
        try {
            const sessionRes = await fetch("/api/client-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: c.name || "Agency Pipeline" }) });
            const { token } = await sessionRes.json();
            startOnlyFansAuthentication(token, {
                onSuccess: async (data: any) => {
                    await fetch("/api/accounts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, ofapiToken: "linked_via_auth_module", ofapiCreatorId: data.accountId || data.username || c.ofapiCreatorId }) });
                    setIsAuthenticatingId(null);
                    window.location.reload();
                },
                onError: (error: any) => { console.error("Auth failed:", error); setIsAuthenticatingId(null); }
            });
        } catch (err) { console.error("Session fetch failed", err); setIsAuthenticatingId(null); }
    };

    const filteredCreators = useMemo(() => {
        if (modelFilter === "all") return creators;
        return creators.filter((c: any) => c.id === modelFilter);
    }, [creators, modelFilter]);

    return (
        <div className="text-white/90 overflow-hidden relative">
            <main className="p-4 md:p-8 md:pl-4 overflow-y-auto z-10 min-h-screen custom-scrollbar relative pb-8">
                <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-8 glass-panel p-4 sm:p-6 rounded-3xl sm:sticky sm:top-0 z-20 border-white/10">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white/95 mb-0.5 sm:mb-1">{t("agencyOverview")}</h1>
                        <p className="text-xs sm:text-sm text-white/60 font-medium">{t("monitoringCreators", { count: creators.length })}</p>
                    </div>
                    <div className="flex gap-2 sm:gap-3 items-center flex-shrink-0">
                        <TimeRangeSelector onChange={handleTimeRangeChange} currentRange={timeRange} />
                        <button onClick={emitOpenAddCreator} className="glass-button px-3 sm:px-5 py-2 sm:py-2.5 font-medium rounded-xl text-sm flex items-center gap-2 text-teal-400 border border-teal-500/30 md:hidden">{t("add")}</button>
                        <button className="glass-button px-3 sm:px-5 py-2 sm:py-2.5 font-medium rounded-xl text-sm flex items-center gap-2 text-white"><Settings size={16} /><span className="hidden md:inline">{t("settings")}</span></button>
                    </div>
                </header>

                {/* Model Picker — prominent dropdown for managers */}
                {creators.length > 1 && (
                    <div className="mb-4 sm:mb-6">
                        <select
                            value={modelFilter}
                            onChange={(e) => setModelFilter(e.target.value)}
                            className="w-full glass-panel rounded-2xl px-4 py-3.5 text-base sm:text-sm font-medium text-white bg-transparent border border-white/10 outline-none cursor-pointer appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
                        >
                            <option value="all" className="bg-[#111]">{t("allModels")}</option>
                            {creators.map((c: any) => (
                                <option key={c.id} value={c.id} className="bg-[#111]">{c.name || c.ofUsername || t("unknown")}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-sm sm:text-lg font-semibold text-white/80">{modelFilter !== "all" ? (creators.find((c: any) => c.id === modelFilter)?.name || t("model")) : t("liveChatterPerformance")}</h2>
                        {timeRange && (
                            <span className="text-xs text-teal-400/60 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">{timeRange.label}</span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading && creators.length === 0 && (
                            <>
                                {[1,2,3].map(i => (
                                    <div key={i} className="glass-panel rounded-3xl border-t border-t-white/20 border-l border-l-white/10 overflow-hidden animate-pulse">
                                        <div className="h-28 bg-white/5" />
                                        <div className="p-5 -mt-8 relative z-10">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-14 h-14 rounded-full bg-white/10 border-[3px] border-black/80" />
                                                <div className="space-y-2">
                                                    <div className="h-4 w-32 bg-white/10 rounded" />
                                                    <div className="h-3 w-20 bg-white/5 rounded" />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="h-8 w-40 bg-white/10 rounded" />
                                                <div className="h-5 w-24 bg-white/5 rounded" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                        {filteredCreators.map((c: any) => (
                            <CreatorCard key={c.id} creator={c} isAuthenticatingId={isAuthenticatingId} onConnectOF={handleConnectOF} onRefresh={() => fetchCreators()} />
                        ))}
                        {filteredCreators.length === 0 && !loading && (
                            <div className="glass-panel p-8 rounded-3xl border-t border-t-white/20 border-l border-l-white/10 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4"><AlertCircle size={32} className="text-teal-500/50" /></div>
                                <h3 className="text-xl font-medium text-white/90 mb-2">{t("noAccountsLinkedTitle")}</h3>
                                <p className="text-sm text-white/50 max-w-xs">{t("noAccountsLinkedDesc")}</p>
                            </div>
                        )}
                    </div>
                </div>

                <HourlyModelCounter />

                <ModulesGrid />
            </main>
        </div>
    );
}

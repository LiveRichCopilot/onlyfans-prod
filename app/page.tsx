"use client";

import { Settings, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
// @ts-ignore: Next relies on Vercel install
import { startOnlyFansAuthentication } from "@onlyfansapi/auth";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { CreatorCard } from "@/components/dashboard/CreatorCard";
import { ModulesGrid } from "@/components/dashboard/ModulesGrid";
import { AddCreatorModal } from "@/components/dashboard/AddCreatorModal";
import { TimeRangeSelector } from "@/components/dashboard/TimeRangeSelector";

type TimeRange = { start: Date; end: Date; label: string };

export default function AgencyDashboard() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [isAuthenticatingId, setIsAuthenticatingId] = useState<string | null>(null);
    const [creators, setCreators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange | null>(null);

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

    return (
        <div className="flex min-h-screen text-white/90 overflow-hidden relative">
            <Sidebar creators={creators} loading={loading} onAddAccount={() => setShowAddModal(true)} />

            <main className="flex-1 p-4 md:p-8 md:pl-4 overflow-y-auto z-10 h-screen custom-scrollbar relative pb-24">
                <header className="flex justify-between items-center mb-8 glass-panel p-6 rounded-3xl sticky top-0 z-20 border-white/10">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white/95 mb-1">Agency Overview</h1>
                        <p className="text-sm text-white/60 font-medium">Monitoring {creators.length} creators globally.</p>
                    </div>
                    <div className="flex gap-3">
                        <TimeRangeSelector onChange={handleTimeRangeChange} currentRange={timeRange} />
                        <button onClick={() => setShowAddModal(true)} className="glass-button px-5 py-2.5 font-medium rounded-xl text-sm flex items-center gap-2 text-teal-400 border border-teal-500/30 md:hidden">+ Add</button>
                        <button className="glass-button px-5 py-2.5 font-medium rounded-xl text-sm flex items-center gap-2 text-white"><Settings size={16} /><span className="hidden md:inline">Settings</span></button>
                    </div>
                </header>

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-lg font-semibold text-white/80">Live Chatter Performance</h2>
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
                        {creators.map((c) => (
                            <CreatorCard key={c.id} creator={c} isAuthenticatingId={isAuthenticatingId} onConnectOF={handleConnectOF} onRefresh={() => fetchCreators()} />
                        ))}
                        {creators.length === 0 && !loading && (
                            <div className="glass-panel p-8 rounded-3xl border-t border-t-white/20 border-l border-l-white/10 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4"><AlertCircle size={32} className="text-teal-500/50" /></div>
                                <h3 className="text-xl font-medium text-white/90 mb-2">No Accounts Linked</h3>
                                <p className="text-sm text-white/50 max-w-xs">Connect your OnlyFans account using the Add Account button.</p>
                            </div>
                        )}
                    </div>
                </div>

                <ModulesGrid />
            </main>

            {showAddModal && <AddCreatorModal onClose={() => setShowAddModal(false)} existingCreators={creators} />}
        </div>
    );
}

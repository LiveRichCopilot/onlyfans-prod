"use client";

import { DollarSign, Users, TrendingUp, Crown } from "lucide-react";

type AgencyData = {
    revenue1h: number;
    revenue24h: number;
    activeFans: number;
    topFans: { username: string; name: string; spend: number; creatorName: string }[];
};

type Props = {
    data: AgencyData | null;
    loading: boolean;
};

export function AgencyStats({ data, loading }: Props) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20 animate-pulse">
                        <div className="h-3 w-24 bg-white/10 rounded mb-3" />
                        <div className="h-8 w-20 bg-white/10 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (!data) return null;

    const topFan = data.topFans[0];

    return (
        <div className="mb-6">
            <h2 className="text-lg font-semibold text-white/80 mb-4 px-2 flex items-center gap-2">
                <TrendingUp size={18} className="text-teal-400" /> Agency Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={14} className="text-emerald-400" />
                        <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Revenue (1h)</span>
                    </div>
                    <div className="text-3xl font-bold text-white">${data.revenue1h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>

                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={14} className="text-teal-400" />
                        <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Revenue (24h)</span>
                    </div>
                    <div className="text-3xl font-bold text-white">${data.revenue24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>

                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Users size={14} className="text-blue-400" />
                        <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Active Fans</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{data.activeFans.toLocaleString()}</div>
                </div>

                <div className="glass-panel p-6 rounded-3xl border-white/5 bg-black/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Crown size={14} className="text-amber-400" />
                        <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">#1 Whale (24h)</span>
                    </div>
                    {topFan ? (
                        <>
                            <div className="text-2xl font-bold text-amber-400">${topFan.spend.toFixed(2)}</div>
                            <div className="text-xs text-white/50 mt-1">@{topFan.username} on {topFan.creatorName}</div>
                        </>
                    ) : (
                        <div className="text-lg text-white/40">No data yet</div>
                    )}
                </div>
            </div>
        </div>
    );
}

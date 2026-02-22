"use client";

import { TrendingUp, Info } from "lucide-react";
import { useState } from "react";

type Props = {
    stats: any;
};

function StatCard({ label, value, sub, color, tooltip }: { label: string; value: string; sub?: string; color?: string; tooltip?: string }) {
    const [showTip, setShowTip] = useState(false);

    return (
        <div className="glass-panel p-4 rounded-2xl border-white/5 bg-black/20 relative">
            <div className="flex items-center justify-between mb-2">
                <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                {tooltip && (
                    <button
                        onClick={() => setShowTip(!showTip)}
                        className="text-white/20 hover:text-white/50 transition-colors"
                    >
                        <Info size={12} />
                    </button>
                )}
            </div>
            <div className={`text-xl md:text-2xl font-bold ${color || "text-white"} truncate`}>{value}</div>
            {sub && <div className="text-[10px] text-white/30 mt-1">{sub}</div>}
            {showTip && tooltip && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-xs text-white/70 shadow-xl">
                    {tooltip}
                    <button onClick={() => setShowTip(false)} className="block mt-1 text-teal-400 text-[10px]">Got it</button>
                </div>
            )}
        </div>
    );
}

export function StatsGrid({ stats }: Props) {
    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const earnings = stats.earningsByType || {};

    return (
        <div className="mb-8 space-y-4">
            {/* Revenue Row */}
            <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 px-1 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={14} className="text-teal-400" /> Revenue
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Today" value={fmt(stats.todayRevenue || 0)} sub={`${stats.txCountToday || 0} transactions`} tooltip="Total gross revenue from midnight to now (LA time)" />
                    <StatCard label="This Hour" value={fmt(stats.hourlyRevenue || 0)} sub="/ hr" tooltip="Revenue in the last 60 minutes" />
                    <StatCard label="7 Days" value={fmt(stats.weeklyRevenue || 0)} sub="last 7 days" tooltip="Total gross revenue over the past 7 days" />
                    <StatCard label="30 Days" value={fmt(stats.monthlyRevenue || 0)} sub="last 30 days" tooltip="Total gross revenue over the past 30 days" />
                </div>
            </div>

            {/* Earnings by Type Row */}
            <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 px-1 uppercase tracking-wider">Earnings by Channel (30d)</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <StatCard label="Subscriptions" value={fmt(earnings.subscriptions || 0)} tooltip="Revenue from new and recurring subscriptions" />
                    <StatCard label="Tips" value={fmt(earnings.tips || 0)} tooltip="Direct tips from fans" />
                    <StatCard label="Posts" value={fmt(earnings.posts || 0)} tooltip="Revenue from paid posts on the feed" />
                    <StatCard label="Messages" value={fmt(earnings.messages || 0)} tooltip="Revenue from paid messages and PPV" />
                    <StatCard label="Streams" value={fmt(earnings.streams || 0)} tooltip="Revenue from live streams" />
                    <StatCard label="Referrals" value={fmt(earnings.referrals || 0)} tooltip="Revenue from referral program" />
                </div>
            </div>

            {/* Profile Stats Row */}
            <div>
                <h2 className="text-sm font-semibold text-white/50 mb-3 px-1 uppercase tracking-wider">Profile</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard label="OF Ranking" value={`${stats.topPercentage}%`} color="text-teal-400" tooltip="Your position on OnlyFans — lower is better (top 0.16% means top 0.16%)" />
                    <StatCard label="Active Fans" value={(stats.activeFans || 0).toLocaleString()} tooltip="Currently subscribed fans" />
                    <StatCard label="Avg / Spender" value={fmt(stats.avgSpendPerSpender || 0)} tooltip="Average amount spent by fans who purchased content or gave tips" />
                    <StatCard label="Avg / Transaction" value={fmt(stats.avgSpendPerTransaction || 0)} tooltip="Average amount per individual transaction today" />
                    <StatCard label="Account Created" value={stats.startDate !== "Unknown" ? new Date(stats.startDate).toLocaleDateString() : "—"} tooltip="When this OnlyFans account started monetizing" />
                </div>
            </div>

            {/* Top Fans Today */}
            {stats.topFans && stats.topFans.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-white/50 mb-3 px-1 uppercase tracking-wider">Top Fans Today</h2>
                    <div className="flex flex-wrap gap-2">
                        {stats.topFans.map((fan: any, i: number) => (
                            <div key={fan.username} className="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl border-white/5 bg-black/20">
                                <span className="text-amber-400 font-bold text-xs">#{i + 1}</span>
                                <span className="text-white/70 text-xs">@{fan.username}</span>
                                <span className="text-teal-400 font-semibold text-xs">{fmt(fan.spend)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

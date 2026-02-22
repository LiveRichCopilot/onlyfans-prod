"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Info } from "lucide-react";

// ── Palette (from Gravity) ──
const COLORS = {
    teal: '#2DD4BF',
    pink: '#F472B6',
    violet: '#A78BFA',
    yellow: '#FBBF24',
    cyan: '#22D3EE',
    green: '#34D399',
    orange: '#FB923C',
};

// ── Glass Card (from Gravity) ──
function GlassCard({ children, className = '', glow }: { children: React.ReactNode; className?: string; glow?: string }) {
    return (
        <div className={`relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/[0.1] transition-all duration-300 ${className}`}>
            {glow && (
                <div
                    className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-15 group-hover:opacity-30 transition-opacity duration-500"
                    style={{ background: glow }}
                />
            )}
            {children}
        </div>
    );
}

// ── Stat Card (from Gravity) ──
function StatCard({ label, value, sub, color, tooltip }: {
    label: string; value: string; sub?: string; color: string; tooltip?: string;
}) {
    const [showTip, setShowTip] = useState(false);

    return (
        <GlassCard className="p-5" glow={color}>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    </div>
                    {tooltip && (
                        <button onClick={() => setShowTip(!showTip)} className="text-white/20 hover:text-white/50 transition-colors">
                            <Info size={12} />
                        </button>
                    )}
                </div>
                <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{label}</p>
                {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
            </div>
            {showTip && tooltip && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#12141a]/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl">
                    <p className="text-xs text-white/60">{tooltip}</p>
                    <button onClick={() => setShowTip(false)} className="text-teal-400 text-[10px] mt-1">Got it</button>
                </div>
            )}
        </GlassCard>
    );
}

type Props = {
    stats: any;
};

export function StatsGrid({ stats }: Props) {
    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const earnings = stats.earningsByType || {};

    // Only show earning channels with money
    const channels = [
        { label: "Tips", value: earnings.tips, color: COLORS.teal, tooltip: "Direct tips from fans" },
        { label: "Messages", value: earnings.messages, color: COLORS.pink, tooltip: "Revenue from paid messages and PPV content" },
        { label: "Posts", value: earnings.posts, color: COLORS.violet, tooltip: "Revenue from paid posts on the feed" },
        { label: "Subscriptions", value: earnings.subscriptions, color: COLORS.cyan, tooltip: "Revenue from new and recurring subscriptions" },
        { label: "Streams", value: earnings.streams, color: COLORS.yellow, tooltip: "Revenue from live streams" },
        { label: "Referrals", value: earnings.referrals, color: COLORS.green, tooltip: "Revenue from the referral program" },
    ].filter(c => c.value > 0);

    return (
        <div className="mb-8 space-y-6">
            {/* Revenue — Big Numbers */}
            <div>
                <h2 className="text-[11px] uppercase tracking-wider text-white/35 font-medium mb-4 px-1">Revenue (Gross)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Today (UK)" value={fmt(stats.todayRevenue || 0)} sub={`${stats.txCountToday || 0} transactions`} color={COLORS.teal} tooltip="Total gross since midnight UK time" />
                    <StatCard label="This Hour" value={fmt(stats.hourlyRevenue || 0)} sub="last 60 min" color={COLORS.cyan} tooltip="Revenue in the last 60 minutes" />
                    <StatCard label="7 Days" value={fmt(stats.weeklyRevenue || 0)} sub="last 7 days" color={COLORS.violet} tooltip="Total gross revenue over the past 7 days" />
                    <StatCard label="30 Days" value={fmt(stats.monthlyRevenue || 0)} sub="last 30 days" color={COLORS.pink} tooltip="Total gross revenue over the past 30 days" />
                </div>
            </div>

            {/* Earnings by Channel — only non-zero */}
            {channels.length > 0 && (
                <div>
                    <h2 className="text-[11px] uppercase tracking-wider text-white/35 font-medium mb-4 px-1">Earnings by Channel (30d)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {channels.map(ch => (
                            <StatCard key={ch.label} label={ch.label} value={fmt(ch.value || 0)} color={ch.color} tooltip={ch.tooltip} />
                        ))}
                    </div>
                </div>
            )}

            {/* Profile & Audience */}
            <div>
                <h2 className="text-[11px] uppercase tracking-wider text-white/35 font-medium mb-4 px-1">Profile & Audience</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard label="OF Ranking" value={`${stats.topPercentage}%`} color={COLORS.teal} tooltip="Your position on OnlyFans — lower is better (0.16% = top 0.16%)" />
                    <StatCard label="Subscribers" value={(stats.subscribersCount || stats.activeFans || 0).toLocaleString()} color={COLORS.cyan} tooltip="Total subscribers on this account" />
                    <StatCard label="New Subs (7d)" value={(stats.newSubs || 0).toLocaleString()} color={COLORS.green} tooltip="New subscriptions in the last 7 days" />
                    <StatCard label="Visitors (7d)" value={(stats.visitors || 0).toLocaleString()} color={COLORS.violet} tooltip="Profile visitors in the last 7 days" />
                    <StatCard label="Avg / Spender" value={fmt(stats.avgSpendPerSpender || 0)} color={COLORS.orange} tooltip="Average amount spent by fans who purchased content or tipped today" />
                    <StatCard label="Avg / Transaction" value={fmt(stats.avgSpendPerTransaction || 0)} color={COLORS.yellow} tooltip="Average amount per individual transaction today" />
                </div>
            </div>

            {/* Mass Messages */}
            {(stats.massMessages?.count > 0 || stats.massMessages?.earnings > 0) && (
                <div>
                    <h2 className="text-[11px] uppercase tracking-wider text-white/35 font-medium mb-4 px-1">Mass Messages (7d)</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Messages Sent" value={(stats.massMessages.count || 0).toLocaleString()} color={COLORS.pink} tooltip="Total mass messages sent in the last 7 days" />
                        <StatCard label="Mass Msg Revenue" value={fmt(stats.massMessages.earnings || 0)} color={COLORS.pink} tooltip="Gross revenue from mass messages (PPV)" />
                    </div>
                </div>
            )}

            {/* Top Fans Today */}
            {stats.topFans && stats.topFans.length > 0 && (
                <div>
                    <h2 className="text-[11px] uppercase tracking-wider text-white/35 font-medium mb-4 px-1">Top Fans Today</h2>
                    <div className="flex flex-wrap gap-2">
                        {stats.topFans.map((fan: any, i: number) => (
                            <GlassCard key={fan.username} className="px-4 py-2.5 flex items-center gap-3" glow={i === 0 ? COLORS.pink : undefined}>
                                <span className="relative z-10 text-xs font-bold" style={{ color: i === 0 ? COLORS.pink : i === 1 ? COLORS.violet : COLORS.teal }}>#{i + 1}</span>
                                <span className="relative z-10 text-xs text-white/60">@{fan.username}</span>
                                <span className="relative z-10 text-xs font-semibold text-white">{fmt(fan.spend)}</span>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

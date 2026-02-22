"use client";

import { TrendingUp } from "lucide-react";

type Props = {
    stats: any;
};

export function StatsGrid({ stats }: Props) {
    const cards = [
        {
            label: "Today",
            value: `$${(stats.todayRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: `${stats.txCountToday || 0} transactions`,
            color: "text-white",
        },
        {
            label: "This Hour",
            value: `$${(stats.hourlyRevenue || 0).toFixed(2)}`,
            sub: "/ hr",
            color: "text-white",
        },
        {
            label: "7 Days",
            value: `$${(stats.weeklyRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: "last 7 days",
            color: "text-white",
        },
        {
            label: "30 Days",
            value: `$${(stats.monthlyRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: "last 30 days",
            color: "text-white",
        },
        {
            label: "Top Percentage",
            value: `${stats.topPercentage}%`,
            sub: "on OnlyFans",
            color: "text-teal-400",
        },
        {
            label: "Active Subscribers",
            value: (stats.activeFans || 0).toLocaleString(),
            sub: "current fans",
            color: "text-white",
        },
        {
            label: "Account Created",
            value: stats.startDate !== "Unknown" ? new Date(stats.startDate).toLocaleDateString() : "Unknown",
            sub: "",
            color: "text-white",
        },
    ];

    return (
        <div className="mb-8">
            <h2 className="text-lg font-semibold text-white/80 mb-4 px-2 flex items-center gap-2">
                <TrendingUp size={18} className="text-teal-400" /> Live Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {cards.map((card) => (
                    <div key={card.label} className="glass-panel p-4 rounded-2xl border-white/5 bg-black/20">
                        <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-2">{card.label}</div>
                        <div className={`text-2xl md:text-3xl font-bold ${card.color}`}>{card.value}</div>
                        {card.sub && <div className="text-xs text-white/30 mt-1">{card.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Top Fans Today */}
            {stats.topFans && stats.topFans.length > 0 && (
                <div className="mt-4 glass-panel p-4 rounded-2xl border-white/5 bg-black/20">
                    <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-3">Top Fans Today</div>
                    <div className="flex flex-wrap gap-3">
                        {stats.topFans.map((fan: any, i: number) => (
                            <div key={fan.username} className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
                                <span className="text-amber-400 font-bold text-sm">#{i + 1}</span>
                                <span className="text-white/80 text-sm">@{fan.username}</span>
                                <span className="text-teal-400 font-semibold text-sm">${fan.spend.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

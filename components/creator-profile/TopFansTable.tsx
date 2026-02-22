"use client";

import { useState } from "react";

const COLORS = { teal: '#2DD4BF', pink: '#F472B6', violet: '#A78BFA' };

type Fan = { username: string; name: string; spend: number };

type Props = {
    today: Fan[];
    week: Fan[];
    month: Fan[];
};

export function TopFansTable({ today, week, month }: Props) {
    const [tab, setTab] = useState<"today" | "week" | "month">("today");
    const fans = tab === "today" ? today : tab === "week" ? week : month;
    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!today.length && !week.length && !month.length) return null;

    return (
        <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden p-5 mb-6">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-15" style={{ background: COLORS.pink }} />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] uppercase tracking-wider text-white/35 font-medium">Top Fans</h3>
                    <div className="flex gap-1">
                        {(["today", "week", "month"] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${tab === t ? "bg-white/10 text-white border border-white/10" : "text-white/30 hover:text-white/50"}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {fans.length === 0 ? (
                    <p className="text-xs text-white/30">No fan data for this period.</p>
                ) : (
                    <div className="space-y-2">
                        {fans.map((fan, i) => (
                            <div key={fan.username} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold w-6" style={{ color: i === 0 ? COLORS.pink : i === 1 ? COLORS.violet : COLORS.teal }}>
                                        #{i + 1}
                                    </span>
                                    <div>
                                        <span className="text-sm text-white/80">@{fan.username}</span>
                                        {fan.name && fan.name !== fan.username && (
                                            <span className="text-xs text-white/30 ml-2">{fan.name}</span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-white">{fmt(fan.spend)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { GlassCard } from "./GlassCard";

type Props = {
    label: string;
    value: string;
    sub?: string;
    color: string;
    tooltip?: string;
};

export function StatCard({ label, value, sub, color, tooltip }: Props) {
    const [showTip, setShowTip] = useState(false);

    return (
        <GlassCard className="p-3 md:p-5" glow={color}>
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
                <p className="text-lg md:text-2xl font-semibold tracking-tight text-white">{value}</p>
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

"use client";

import type { Chat } from "./types";

type FanData = {
    totalSpend: number;
    lastPaid: string | null;
    fanSince: string | null;
    txCount: number;
};

type Props = {
    chat: Chat;
    fanData: FanData | null;
    loading: boolean;
};

export function FanInfo({ chat, fanData, loading }: Props) {
    const spend = fanData?.totalSpend ?? chat.totalSpend ?? 0;

    const rows = [
        { label: "Fan since", value: fanData?.fanSince || "-" },
        { label: "Total spend", value: `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, highlight: spend > 0 },
        { label: "Last paid", value: fanData?.lastPaid || "-" },
        { label: "Transactions", value: fanData?.txCount?.toString() || "-" },
        { label: "Came from", value: "-" },
        { label: "Location", value: "-" },
    ];

    return (
        <div className="border border-white/[0.08] rounded-2xl p-4">
            <h4 className="text-sm font-bold tracking-tight text-white/90 mb-4">Info</h4>

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500" />
                </div>
            ) : (
                <div className="space-y-3 text-sm">
                    {rows.map((row) => (
                        <div key={row.label} className="flex justify-between items-center">
                            <span className="text-white/50">{row.label}</span>
                            <span className={row.highlight ? "font-bold text-teal-400" : "text-white/80"}>{row.value}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center bg-white/5 -mx-4 -mb-4 mt-4 px-4 py-3 rounded-b-2xl border-t border-white/5">
                <span className="text-white/50 text-xs">Last seen parsing</span>
                <span className="text-xs text-white/80 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]" />
                    Live Feed
                </span>
            </div>
        </div>
    );
}

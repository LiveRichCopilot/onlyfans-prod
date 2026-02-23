"use client";

import type { Chat } from "./types";
import type { FanData } from "./FanSidebar";

type Props = {
    chat: Chat;
    fanData: FanData | null;
    loading: boolean;
};

// Stage badge color
function stageColor(stage: string | null): string {
    switch (stage) {
        case "active_buyer": return "#2DD4BF";
        case "warming": return "#FBBF24";
        case "new": return "#A78BFA";
        case "cooling_off": return "#F59E0B";
        case "at_risk": return "#EF4444";
        case "churned": return "#64748B";
        case "reactivated": return "#22D3EE";
        default: return "#64748B";
    }
}

function stageLabel(stage: string | null): string {
    if (!stage) return "Unknown";
    return stage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function FanInfo({ chat, fanData, loading }: Props) {
    const spend = fanData?.totalSpend ?? chat.totalSpend ?? 0;
    const intel = fanData?.intelligence;

    const rows = [
        { label: "Fan since", value: fanData?.fanSince || "-" },
        { label: "Total spend", value: `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, highlight: spend > 0 },
        { label: "Last paid", value: fanData?.lastPaid || "-" },
        { label: "Last type", value: (fanData?.lastPurchaseType || "-").replace(/<[^>]*>/g, "").slice(0, 30) },
        { label: "Transactions", value: fanData?.txCount?.toString() || "-" },
    ];

    // Intelligence rows (only show non-null)
    const intelRows = intel ? [
        intel.fanType && { label: "Fan type", value: stageLabel(intel.fanType) },
        intel.buyerType && { label: "Buyer type", value: stageLabel(intel.buyerType) },
        intel.tonePreference && { label: "Tone", value: stageLabel(intel.tonePreference) },
        intel.priceRange && { label: "Price range", value: intel.priceRange },
        intel.formatPreference && { label: "Prefers", value: stageLabel(intel.formatPreference) },
        intel.avgOrderValue && { label: "Avg order", value: `$${intel.avgOrderValue.toFixed(2)}` },
        intel.conversionRate !== null && intel.conversionRate !== undefined && { label: "Conversion", value: `${(intel.conversionRate * 100).toFixed(0)}%` },
    ].filter(Boolean) as { label: string; value: string }[] : [];

    return (
        <div className="border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold tracking-tight text-white/90">Info</h4>
                {/* Stage badge */}
                {intel?.stage && (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{
                            color: stageColor(intel.stage),
                            borderColor: stageColor(intel.stage) + "40",
                            backgroundColor: stageColor(intel.stage) + "15",
                        }}
                    >
                        {stageLabel(intel.stage)}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500" />
                </div>
            ) : (
                <>
                    <div className="space-y-3 text-sm">
                        {rows.map((row) => (
                            <div key={row.label} className="flex justify-between items-center">
                                <span className="text-white/50">{row.label}</span>
                                <span className={row.highlight ? "font-bold text-teal-400" : "text-white/80"}>{row.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Intelligence section */}
                    {intelRows.length > 0 && (
                        <>
                            <div className="border-t border-white/[0.06] my-3" />
                            <div className="space-y-3 text-sm">
                                {intelRows.map((row) => (
                                    <div key={row.label} className="flex justify-between items-center">
                                        <span className="text-white/50">{row.label}</span>
                                        <span className="text-white/80">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Next best action */}
                    {intel?.nextBestAction && (
                        <>
                            <div className="border-t border-white/[0.06] my-3" />
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3">
                                <div className="text-[10px] text-teal-400/70 font-semibold uppercase tracking-wider mb-1">Next Best Action</div>
                                <div className="text-sm text-teal-300 font-medium">
                                    {stageLabel(intel.nextBestAction)}
                                </div>
                                {intel.nextBestActionReason && (
                                    <div className="text-[11px] text-white/40 mt-0.5">{intel.nextBestActionReason}</div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Buy patterns */}
                    {fanData?.buyPatterns && (
                        <>
                            <div className="border-t border-white/[0.06] my-3" />
                            <div className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">Buy Patterns</div>
                            <div className="space-y-2.5 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-white/50">Favorite day</span>
                                    <span className="text-white/80">{fanData.buyPatterns.favoriteDayOfWeek}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white/50">Favorite time</span>
                                    <span className="text-white/80">{fanData.buyPatterns.favoriteHour}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white/50">Buys every</span>
                                    <span className="text-white/80">~{fanData.buyPatterns.avgDaysBetweenPurchases}d</span>
                                </div>
                                {fanData.buyPatterns.typeBreakdown.length > 0 && (
                                    <div className="space-y-1 pt-1">
                                        {fanData.buyPatterns.typeBreakdown
                                            .sort((a, b) => b.total - a.total)
                                            .map(tb => (
                                                <div key={tb.type} className="flex justify-between items-center text-[12px]">
                                                    <span className="text-white/40 capitalize">{tb.type}</span>
                                                    <span className="text-white/60">{tb.count}x (${tb.total.toLocaleString()})</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Narrative summary */}
                    {intel?.narrativeSummary && (
                        <div className="mt-3 text-[12px] text-white/40 italic leading-relaxed">
                            {intel.narrativeSummary}
                        </div>
                    )}
                </>
            )}

            <div className="flex justify-center items-center bg-white/5 -mx-4 -mb-4 mt-4 px-4 py-2 rounded-b-2xl border-t border-white/5">
                <span className="text-[10px] text-white/20">Based on conversation history and purchase activity</span>
            </div>
        </div>
    );
}

"use client";

type Props = {
    purchasedCount: number;
    totalPpv: number;
    buyRate: number;
    highestPrice: number;
    lowestPrice: number;
    totalRevenue: number;
};

export function BuyRateBar({ purchasedCount, totalPpv, buyRate, highestPrice, lowestPrice, totalRevenue }: Props) {
    if (totalPpv === 0) return null;

    return (
        <div className="space-y-3 mb-4">
            {/* Buy rate headline */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-white/80 font-medium">
                    Buy rate: <span className="text-white font-bold">{purchasedCount}/{totalPpv}</span>
                    <span className="text-white/50 ml-1">({buyRate}%)</span>
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all"
                    style={{
                        width: `${buyRate}%`,
                        backgroundColor: buyRate >= 30 ? "#2DD4BF" : buyRate >= 15 ? "#FBBF24" : "#EF4444",
                    }}
                />
            </div>

            {/* Stats row */}
            <div className="flex gap-2">
                <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
                    <div className="text-sm font-bold text-white">${highestPrice.toLocaleString()}</div>
                    <div className="text-[10px] text-white/40">Highest price</div>
                </div>
                <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
                    <div className="text-sm font-bold text-white">${lowestPrice.toLocaleString()}</div>
                    <div className="text-[10px] text-white/40">Lowest price</div>
                </div>
                {totalRevenue > 0 && (
                    <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
                        <div className="text-sm font-bold text-teal-400">${totalRevenue.toLocaleString()}</div>
                        <div className="text-[10px] text-white/40">PPV revenue</div>
                    </div>
                )}
            </div>
        </div>
    );
}

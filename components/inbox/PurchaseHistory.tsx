"use client";

type Purchase = {
    id: string;
    amount: number;
    type: string;
    date: string;
};

type Props = {
    purchases: Purchase[];
    txCount: number;
    totalSpend: number;
    loading: boolean;
};

// Type label + color
function txLabel(type: string): { label: string; color: string } {
    const t = type?.toLowerCase() || "";
    if (t.includes("tip")) return { label: "Tip", color: "#F472B6" };         // pink
    if (t.includes("message") || t.includes("ppv")) return { label: "PPV Message", color: "#A78BFA" }; // violet
    if (t.includes("post")) return { label: "Paid Post", color: "#22D3EE" };  // cyan
    if (t.includes("subscri") || t.includes("renew")) return { label: "Subscription", color: "#2DD4BF" }; // teal
    if (t.includes("stream")) return { label: "Stream", color: "#FBBF24" };   // yellow
    if (t.includes("referral")) return { label: "Referral", color: "#34D399" }; // green
    return { label: type || "Transaction", color: "#94A3B8" };                 // gray
}

function fmtDate(d: string): string {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmt(n: number): string {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PurchaseHistory({ purchases, txCount, totalSpend, loading }: Props) {
    return (
        <div>
            {/* Summary bar */}
            {!loading && txCount > 0 && (
                <div className="flex items-center justify-between mb-4 px-1">
                    <div>
                        <span className="text-lg font-bold text-white">{fmt(totalSpend)}</span>
                        <span className="text-[11px] text-white/40 ml-1.5">lifetime</span>
                    </div>
                    <span className="text-[11px] text-white/40">{txCount} purchase{txCount !== 1 ? "s" : ""}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500" />
                </div>
            ) : purchases.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-xs text-white/40">No purchase history yet.</p>
                    <p className="text-[10px] text-white/25 mt-1">Purchases will appear after sync runs.</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {purchases.map((p) => {
                        const { label, color } = txLabel(p.type);
                        return (
                            <div
                                key={p.id}
                                className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                            >
                                <div className="min-w-0 flex items-center gap-2">
                                    {/* Type dot */}
                                    <div
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <div>
                                        <div className="text-sm text-white/80">{label}</div>
                                        <div className="text-[11px] text-white/35">{fmtDate(p.date)}</div>
                                    </div>
                                </div>
                                <span
                                    className="text-sm font-semibold flex-shrink-0 ml-3"
                                    style={{ color }}
                                >
                                    {fmt(p.amount)}
                                </span>
                            </div>
                        );
                    })}

                    {/* "Showing X of Y" indicator */}
                    {txCount > purchases.length && (
                        <p className="text-[10px] text-white/30 text-center pt-2">
                            Showing {purchases.length} of {txCount} purchases
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

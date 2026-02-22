"use client";

import { useState } from "react";

type Purchase = {
    id: string;
    amount: number;
    type: string;
    date: string;
    description?: string;
};

type Props = {
    purchases: Purchase[];
    loading: boolean;
};

function FilterButton({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
    const activeClass = color === "teal"
        ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
        : "bg-purple-500/20 text-purple-400 border border-purple-500/30";
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${active ? activeClass : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}
        >
            {label}
        </button>
    );
}

export function PurchaseHistory({ purchases, loading }: Props) {
    const [purchaseFilter, setPurchaseFilter] = useState<"all" | "purchased" | "not_purchased">("all");
    const [typeFilter, setTypeFilter] = useState<"all" | "mass" | "direct">("all");

    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    return (
        <div>
            <div className="flex gap-2 flex-wrap mb-4">
                <FilterButton label="All" active={purchaseFilter === "all"} color="teal" onClick={() => setPurchaseFilter("all")} />
                <FilterButton label="Purchased" active={purchaseFilter === "purchased"} color="teal" onClick={() => setPurchaseFilter("purchased")} />
                <FilterButton label="Not Purchased" active={purchaseFilter === "not_purchased"} color="teal" onClick={() => setPurchaseFilter("not_purchased")} />
                <div className="w-px bg-white/10 mx-1" />
                <FilterButton label="All" active={typeFilter === "all"} color="purple" onClick={() => setTypeFilter("all")} />
                <FilterButton label="Mass" active={typeFilter === "mass"} color="purple" onClick={() => setTypeFilter("mass")} />
                <FilterButton label="Direct" active={typeFilter === "direct"} color="purple" onClick={() => setTypeFilter("direct")} />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-5 h-5 rounded-full border-2 border-white/10 border-t-teal-500" />
                </div>
            ) : purchases.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-xs text-white/40">No purchase history found for this fan.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {purchases.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                            <div className="min-w-0">
                                <div className="text-sm text-white/80 truncate">{p.type || "Transaction"}</div>
                                <div className="text-[11px] text-white/35">{fmtDate(p.date)}</div>
                            </div>
                            <span className="text-sm font-semibold text-teal-400 flex-shrink-0 ml-3">{fmt(p.amount)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

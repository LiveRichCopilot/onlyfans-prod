"use client";

import { useState } from "react";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
};

export function PurchaseHistory({ chat }: Props) {
    const [purchaseFilter, setPurchaseFilter] = useState<"all" | "purchased" | "not_purchased">("all");
    const [typeFilter, setTypeFilter] = useState<"all" | "mass" | "direct">("all");

    return (
        <div>
            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap mb-4">
                <button onClick={() => setPurchaseFilter("all")} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${purchaseFilter === "all" ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>All</button>
                <button onClick={() => setPurchaseFilter("purchased")} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${purchaseFilter === "purchased" ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>Purchased</button>
                <button onClick={() => setPurchaseFilter("not_purchased")} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${purchaseFilter === "not_purchased" ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>Not Purchased</button>
                <div className="w-px bg-white/10 mx-1" />
                <button onClick={() => setTypeFilter("all")} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${typeFilter === "all" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>All</button>
                <button onClick={() => setTypeFilter("mass")} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${typeFilter === "mass" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>Mass</button>
                <button onClick={() => setTypeFilter("direct")} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${typeFilter === "direct" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>Direct</button>
            </div>

            {/* Purchase Timeline — placeholder, will be wired to OFAPI */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                <p className="text-xs text-white/40">Purchase history will appear here once wired to OFAPI transaction data.</p>
            </div>
        </div>
    );
}

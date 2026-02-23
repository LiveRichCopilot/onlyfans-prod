"use client";

import { useState, useEffect, useCallback } from "react";
import { BuyRateBar } from "./BuyRateBar";
import { PpvFilters } from "./PpvFilters";
import { PpvCard } from "./PpvCard";

type PpvItem = {
    messageId: string;
    createdAt: string;
    price: number;
    purchased: boolean;
    isMass: boolean;
    mediaCount: number;
    thumbnails: { id: string; type: string; thumb: string; preview: string }[];
    totalThumbs: number;
    text: string;
    mediaIds: number[];
};

type PpvStats = {
    totalPpv: number;
    purchasedCount: number;
    notPurchasedCount: number;
    buyRate: number;
    totalRevenue: number;
    highestPrice: number;
    lowestPrice: number;
    massCount: number;
    directCount: number;
    messagesScanned: number;
};

type Props = {
    creatorId?: string;
    chatId?: string;
};

function formatDateHeader(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDate.getTime() === today.getTime()) return "Today";
    if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function PurchaseHistory({ creatorId, chatId }: Props) {
    const [ppvs, setPpvs] = useState<PpvItem[]>([]);
    const [stats, setStats] = useState<PpvStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [purchaseFilter, setPurchaseFilter] = useState<"all" | "purchased" | "not_purchased">("all");
    const [typeFilter, setTypeFilter] = useState<"all" | "mass" | "direct">("all");

    const fetchPpvHistory = useCallback(() => {
        if (!creatorId || !chatId) return;
        setLoading(true);
        fetch(`/api/inbox/ppv-history?creatorId=${creatorId}&chatId=${chatId}`)
            .then(r => r.json())
            .then(data => {
                if (!data.error) {
                    setPpvs(data.ppvs || []);
                    setStats(data.stats || null);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [creatorId, chatId]);

    useEffect(() => {
        fetchPpvHistory();
    }, [fetchPpvHistory]);

    // Apply filters
    const filtered = ppvs.filter(p => {
        if (purchaseFilter === "purchased" && !p.purchased) return false;
        if (purchaseFilter === "not_purchased" && p.purchased) return false;
        if (typeFilter === "mass" && !p.isMass) return false;
        if (typeFilter === "direct" && p.isMass) return false;
        return true;
    });

    // Group by date
    const groups: { date: string; label: string; items: PpvItem[] }[] = [];
    let lastKey = "";
    for (const ppv of filtered) {
        const key = dateKey(ppv.createdAt);
        if (key !== lastKey) {
            groups.push({ date: key, label: formatDateHeader(ppv.createdAt), items: [] });
            lastKey = key;
        }
        groups[groups.length - 1].items.push(ppv);
    }

    return (
        <div>
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="animate-spin w-6 h-6 rounded-full border-2 border-white/10 border-t-teal-500" />
                    <span className="text-xs text-white/40">Scanning messages for PPVs...</span>
                </div>
            ) : stats && stats.totalPpv > 0 ? (
                <>
                    <BuyRateBar
                        purchasedCount={stats.purchasedCount}
                        totalPpv={stats.totalPpv}
                        buyRate={stats.buyRate}
                        highestPrice={stats.highestPrice}
                        lowestPrice={stats.lowestPrice}
                        totalRevenue={stats.totalRevenue}
                    />

                    <PpvFilters
                        purchaseFilter={purchaseFilter}
                        typeFilter={typeFilter}
                        onPurchaseFilterChange={setPurchaseFilter}
                        onTypeFilterChange={setTypeFilter}
                        purchasedCount={stats.purchasedCount}
                        notPurchasedCount={stats.notPurchasedCount}
                        massCount={stats.massCount}
                        directCount={stats.directCount}
                    />

                    {/* PPV cards grouped by date */}
                    <div className="space-y-1">
                        {groups.map(group => (
                            <div key={group.date}>
                                <div className="text-[11px] text-white/30 font-medium py-2 sticky top-0 bg-black/30 backdrop-blur-sm">
                                    {group.label}
                                </div>
                                <div className="divide-y divide-white/[0.04]">
                                    {group.items.map(ppv => (
                                        <PpvCard key={ppv.messageId} ppv={ppv} creatorId={creatorId} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filtered.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-xs text-white/40">No PPVs match this filter.</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center py-4">
                        <p className="text-[10px] text-white/25">
                            {stats.totalPpv} PPVs found across {stats.messagesScanned || "?"} messages
                        </p>
                    </div>
                </>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-xs text-white/40">No PPV messages found in this conversation.</p>
                    <p className="text-[10px] text-white/25 mt-1">PPVs are messages with price &gt; $0</p>
                </div>
            )}
        </div>
    );
}

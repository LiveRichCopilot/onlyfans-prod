"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Download, FileText, BarChart3, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Report = {
    date: string;
    creatorId: string;
    creatorName: string;
    creatorUsername: string;
    subsGross: number;
    newSubsGross: number;
    recurringSubsGross: number;
    tipsGross: number;
    totalGross: number;
    contributionPct: number;
    topPercentage: number | null;
    followingCount: number;
    fansRenewOn: number;
    renewOnPct: number;
    newSubs: number;
    activeFans: number;
    expiredFanChange: number;
    postsGross: number;
    messagesGross: number;
    streamsGross: number;
    refundGross: number;
    creatorGroup: string;
    avgSpendPerSpender: number;
    avgSpendPerTransaction: number;
    avgEarningsPerFan: number;
    avgSubLength: number;
    day: string;
    week: number;
    month: string;
    year: number;
    subscribersCount: number;
};

export default function ReportsPage() {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [creatorFilter, setCreatorFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        fetchReports();
    }, [days]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/creator-daily?days=${days}`);
            const data = await res.json();
            setReports(data.reports || []);
        } catch (err) {
            console.error("Failed to load reports", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredReports = creatorFilter
        ? reports.filter((r) => r.creatorId === creatorFilter)
        : reports;

    const creators = Array.from(
        new Map(reports.map((r) => [r.creatorId, { id: r.creatorId, name: r.creatorName }])).values()
    );

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return creators.filter((c) =>
            (c.name || "").toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
        );
    }, [searchQuery, creators]);

    const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pct = (n: number) => `${n.toFixed(1)}%`;

    // Totals
    const totalGross = filteredReports.reduce((s, r) => s + r.totalGross, 0);
    const totalSubs = filteredReports.reduce((s, r) => s + r.subsGross, 0);
    const totalTips = filteredReports.reduce((s, r) => s + r.tipsGross, 0);
    const totalMessages = filteredReports.reduce((s, r) => s + r.messagesGross, 0);
    const totalRefunds = filteredReports.reduce((s, r) => s + r.refundGross, 0);
    const totalNewSubs = filteredReports.reduce((s, r) => s + r.newSubs, 0);

    return (
        <div className="min-h-screen text-white/90 p-4 md:p-8 max-w-[1800px] mx-auto" onClick={() => searchOpen && setSearchOpen(false)}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white border border-white/5"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2 sm:gap-3">
                            <BarChart3 size={22} className="text-teal-400 shrink-0" /> <span className="truncate">Historical Sales</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-white/50 mt-1">
                            {filteredReports.length} rows &middot; {creators.length} creators &middot; Last {days} days
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={`/api/reports/creator-daily?days=${days}&format=csv${creatorFilter ? `&creatorId=${creatorFilter}` : ""}`}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium transition border border-white/10 text-sm"
                    >
                        <Download size={16} /> CSV
                    </a>
                    <a
                        href={`/api/reports/creator-daily?days=${days}&format=pdf${creatorFilter ? `&creatorId=${creatorFilter}` : ""}`}
                        target="_blank"
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium transition border border-white/10 text-sm"
                    >
                        <FileText size={16} /> PDF
                    </a>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6 items-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {[7, 14, 30, 60, 90].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                                days === d
                                    ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                                    : "text-white/40 hover:text-white/60 border border-transparent"
                            }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
                {/* Model Search */}
                <div className="relative ml-auto min-w-[160px]">
                    <div className="glass-panel rounded-xl flex items-center gap-2 px-3 h-9 border border-white/10">
                        <Search size={14} className="text-white/40 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search model..."
                            value={creatorFilter ? (creators.find((c) => c.id === creatorFilter)?.name || searchQuery) : searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); if (creatorFilter) setCreatorFilter(""); }}
                            onFocus={() => setSearchOpen(true)}
                            className="bg-transparent text-sm text-white border-none outline-none w-full placeholder:text-white/30"
                        />
                        {(creatorFilter || searchQuery) && (
                            <button onClick={() => { setCreatorFilter(""); setSearchQuery(""); setSearchOpen(false); }} className="text-white/40 hover:text-white/70">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {searchOpen && (searchResults.length > 0 || (!searchQuery.trim() && creators.length > 0)) && (
                        <div className="absolute top-full left-0 right-0 mt-1 glass-card rounded-xl border border-white/10 max-h-60 overflow-y-auto z-50">
                            {(searchQuery.trim() ? searchResults : creators).map((c) => (
                                <button key={c.id} onClick={() => { setCreatorFilter(c.id); setSearchQuery(""); setSearchOpen(false); }}
                                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 border-b border-white/5 last:border-0">
                                    {c.name || "Unknown"}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 mb-6">
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">Total Gross</div>
                    <div className="text-lg sm:text-2xl font-bold text-white">{fmt(totalGross)}</div>
                </div>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">Subs</div>
                    <div className="text-lg sm:text-2xl font-bold text-teal-400">{fmt(totalSubs)}</div>
                </div>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">Tips</div>
                    <div className="text-lg sm:text-2xl font-bold text-purple-400">{fmt(totalTips)}</div>
                </div>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">Messages</div>
                    <div className="text-lg sm:text-2xl font-bold text-pink-400">{fmt(totalMessages)}</div>
                </div>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">Refunds</div>
                    <div className="text-lg sm:text-2xl font-bold text-red-400">{fmt(totalRefunds)}</div>
                </div>
                <div className="glass-card rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1">New Fans</div>
                    <div className="text-lg sm:text-2xl font-bold text-blue-400">{totalNewSubs.toLocaleString()}</div>
                </div>
            </div>

            {/* Table — Full 29-column spreadsheet */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mr-3" />
                    Loading Reports...
                </div>
            ) : (
                <div className="glass-panel rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-white/10">
                                    {[
                                        "Date UTC+0", "Creator", "Sub Gross", "New Sub $",
                                        "Recur Sub $", "Tips", "Total Gross", "Contrib%",
                                        "OF Rank", "Following", "Renew On", "Renew%",
                                        "New Fans", "Active Fans", "Expired \u0394",
                                        "Posts $", "Msgs $", "Streams $", "Refund $",
                                        "Group", "$/Spender", "$/Tx", "$/Fan",
                                        "Avg Sub Len", "Date", "Day", "Wk", "Month", "Year",
                                    ].map((h) => (
                                        <th key={h} className="pb-4 pt-5 px-3 text-[10px] font-semibold text-white/40 uppercase tracking-widest text-right first:text-left [&:nth-child(2)]:text-left [&:nth-child(20)]:text-left [&:nth-child(25)]:text-left [&:nth-child(27)]:text-left">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredReports.map((r, i) => (
                                    <tr key={`${r.creatorId}-${r.date}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-2.5 px-3 text-xs text-white/60">{r.date}</td>
                                        <td className="py-2.5 px-3 text-xs font-medium text-white">{r.creatorName || "Unknown"}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-teal-400/80">{fmt(r.subsGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-teal-400/60">{fmt(r.newSubsGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-teal-400/60">{fmt(r.recurringSubsGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-purple-400/80">{fmt(r.tipsGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right font-medium text-white">{fmt(r.totalGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{pct(r.contributionPct)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{r.topPercentage != null ? pct(r.topPercentage) : "N/A"}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{r.followingCount.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{r.fansRenewOn.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{pct(r.renewOnPct)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-blue-400/80">{r.newSubs}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{r.activeFans.toLocaleString()}</td>
                                        <td className={`py-2.5 px-3 text-xs text-right ${r.expiredFanChange < 0 ? "text-red-400/70" : "text-white/40"}`}>
                                            {r.expiredFanChange}
                                        </td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{fmt(r.postsGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-pink-400/80">{fmt(r.messagesGross)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{fmt(r.streamsGross)}</td>
                                        <td className={`py-2.5 px-3 text-xs text-right ${r.refundGross > 0 ? "text-red-400/70" : "text-white/40"}`}>
                                            {fmt(r.refundGross)}
                                        </td>
                                        <td className="py-2.5 px-3 text-xs text-white/40">{r.creatorGroup}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{fmt(r.avgSpendPerSpender)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{fmt(r.avgSpendPerTransaction)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{fmt(r.avgEarningsPerFan)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/50">{r.avgSubLength.toFixed(1)}</td>
                                        <td className="py-2.5 px-3 text-xs text-white/40">{r.date}</td>
                                        <td className="py-2.5 px-3 text-xs text-white/40">{r.day?.slice(0, 3)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/40">{r.week}</td>
                                        <td className="py-2.5 px-3 text-xs text-white/40">{r.month?.slice(0, 3)}</td>
                                        <td className="py-2.5 px-3 text-xs text-right text-white/40">{r.year}</td>
                                    </tr>
                                ))}
                                {filteredReports.length === 0 && (
                                    <tr>
                                        <td colSpan={29} className="py-12 text-center text-sm text-white/40 italic">
                                            No report data yet. The cron runs daily at 06:00 UTC.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

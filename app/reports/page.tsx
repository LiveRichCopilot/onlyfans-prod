"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Download, FileText, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

type Report = {
    date: string;
    creatorId: string;
    creatorName: string;
    creatorUsername: string;
    totalGross: number;
    totalNet: number | null;
    subsGross: number;
    tipsGross: number;
    messagesGross: number;
    postsGross: number;
    streamsGross: number;
    subscribersCount: number;
    followingCount: number;
    topPercentage: number | null;
    newSubs: number;
};

export default function ReportsPage() {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [creatorFilter, setCreatorFilter] = useState("");

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

    // Get unique creators for the filter dropdown
    const creators = Array.from(
        new Map(reports.map((r) => [r.creatorId, { id: r.creatorId, name: r.creatorName }])).values()
    );

    const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Totals
    const totalGross = filteredReports.reduce((s, r) => s + r.totalGross, 0);
    const totalSubs = filteredReports.reduce((s, r) => s + r.subsGross, 0);
    const totalTips = filteredReports.reduce((s, r) => s + r.tipsGross, 0);
    const totalMessages = filteredReports.reduce((s, r) => s + r.messagesGross, 0);

    return (
        <div className="min-h-screen text-white/90 p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-white/50 hover:text-white border border-white/5"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            <BarChart3 size={28} className="text-teal-400" /> Creator Reports
                        </h1>
                        <p className="text-sm text-white/50 mt-1">
                            {filteredReports.length} rows &middot; {creators.length} creators &middot; Last {days} days
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={`/api/reports/creator-daily?days=${days}&format=csv${creatorFilter ? `&creatorId=${creatorFilter}` : ""}`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium transition border border-white/10"
                    >
                        <Download size={16} /> CSV
                    </a>
                    <a
                        href={`/api/reports/creator-daily?days=${days}&format=pdf${creatorFilter ? `&creatorId=${creatorFilter}` : ""}`}
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium transition border border-white/10"
                    >
                        <FileText size={16} /> PDF
                    </a>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                {[7, 14, 30, 60, 90].map((d) => (
                    <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                            days === d
                                ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                                : "text-white/40 hover:text-white/60 border border-transparent"
                        }`}
                    >
                        {d}d
                    </button>
                ))}
                <select
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value)}
                    className="ml-auto bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none transition appearance-none cursor-pointer"
                >
                    <option value="">All Creators</option>
                    {creators.map((c) => (
                        <option key={c.id} value={c.id} className="bg-gray-900">
                            {c.name || "Unknown"}
                        </option>
                    ))}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card rounded-2xl p-4">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Total Gross</div>
                    <div className="text-2xl font-bold text-white">{fmt(totalGross)}</div>
                </div>
                <div className="glass-card rounded-2xl p-4">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Subscriptions</div>
                    <div className="text-2xl font-bold text-teal-400">{fmt(totalSubs)}</div>
                </div>
                <div className="glass-card rounded-2xl p-4">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Tips</div>
                    <div className="text-2xl font-bold text-purple-400">{fmt(totalTips)}</div>
                </div>
                <div className="glass-card rounded-2xl p-4">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Messages</div>
                    <div className="text-2xl font-bold text-pink-400">{fmt(totalMessages)}</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mr-3" />
                    Loading Reports...
                </div>
            ) : (
                <div className="glass-panel rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">Date</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest">Creator</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Total</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Subs</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Tips</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Msgs</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Posts</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Fans</th>
                                    <th className="pb-4 pt-5 px-4 text-xs font-semibold text-white/40 uppercase tracking-widest text-right">Top %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredReports.map((r, i) => (
                                    <tr key={`${r.creatorId}-${r.date}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 px-4 text-sm text-white/60">{r.date}</td>
                                        <td className="py-3 px-4 text-sm font-medium text-white">{r.creatorName || "Unknown"}</td>
                                        <td className="py-3 px-4 text-sm text-right font-medium text-white">{fmt(r.totalGross)}</td>
                                        <td className="py-3 px-4 text-sm text-right text-teal-400/80">{fmt(r.subsGross)}</td>
                                        <td className="py-3 px-4 text-sm text-right text-purple-400/80">{fmt(r.tipsGross)}</td>
                                        <td className="py-3 px-4 text-sm text-right text-pink-400/80">{fmt(r.messagesGross)}</td>
                                        <td className="py-3 px-4 text-sm text-right text-white/50">{fmt(r.postsGross)}</td>
                                        <td className="py-3 px-4 text-sm text-right text-white/50">{r.subscribersCount.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-sm text-right text-white/50">
                                            {r.topPercentage != null ? `${r.topPercentage}%` : "N/A"}
                                        </td>
                                    </tr>
                                ))}
                                {filteredReports.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-sm text-white/40 italic">
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

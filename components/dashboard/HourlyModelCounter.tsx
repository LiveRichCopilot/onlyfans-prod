"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Copy, Check } from "lucide-react";
import { ChatterHourlyDrilldown } from "./ChatterHourlyDrilldown";

type CreatorHourly = {
    id: string;
    name: string;
    avatarUrl: string | null;
    hourlyTarget: number;
    hourly: number[];
    total: number;
};

type HourlyData = {
    currentHour: number;
    creators: CreatorHourly[];
    isToday?: boolean;
};

function cellStyle(amount: number, target: number) {
    if (amount === 0) return "text-white/15";
    if (amount >= target * 2) return "text-amber-400 bg-amber-500/10 border border-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.08)]";
    if (amount >= target) return "text-teal-400 bg-teal-500/10 border border-teal-500/15 shadow-[0_0_12px_rgba(13,148,136,0.08)]";
    return "text-white/60 bg-white/[0.02]";
}

function formatHour(hour: number) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "a" : "p";
    return `${h}${ampm}`;
}

function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string | null) {
    if (!dateStr) return "Today";
    const today = toDateStr(new Date());
    if (dateStr === today) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === toDateStr(yesterday)) return "Yesterday";
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function exportCsv(data: HourlyData, dateStr: string | null) {
    const hours = Array.from({ length: data.currentHour + 1 }, (_, i) => i);
    const header = ["Model", ...hours.map((h) => formatHour(h)), "Total"].join(",");
    const rows = data.creators.map((c) => {
        const cells = hours.map((h) => c.hourly[h]?.toFixed(2) || "0.00");
        return [c.name, ...cells, c.total.toFixed(2)].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hourly-breakdown-${dateStr || toDateStr(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function copyToClipboard(data: HourlyData) {
    const hours = Array.from({ length: data.currentHour + 1 }, (_, i) => i);
    const header = ["Model", ...hours.map((h) => formatHour(h)), "Total"].join("\t");
    const rows = data.creators.map((c) => {
        const cells = hours.map((h) => c.hourly[h] > 0 ? `$${c.hourly[h].toFixed(0)}` : "-");
        return [c.name, ...cells, `$${c.total.toFixed(2)}`].join("\t");
    });
    navigator.clipboard.writeText([header, ...rows].join("\n"));
}

// Frosted sticky column style
const stickyCol = "backdrop-blur-[40px] bg-[rgba(5,5,8,0.75)]";

export function HourlyModelCounter() {
    const [data, setData] = useState<HourlyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = today
    const [copied, setCopied] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchData = useCallback((dateStr?: string | null) => {
        const url = dateStr
            ? `/api/creators/hourly-breakdown?date=${dateStr}`
            : "/api/creators/hourly-breakdown";
        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`API ${res.status}`);
                return res.json();
            })
            .then((d) => {
                if (d.error) throw new Error(d.error);
                setData(d);
                setError(null);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Hourly fetch error:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchData(selectedDate);

        // Only auto-refresh if viewing today
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (!selectedDate) {
            intervalRef.current = setInterval(() => fetchData(null), 60000);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [selectedDate, fetchData]);

    function goBack() {
        const current = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
        current.setDate(current.getDate() - 1);
        setSelectedDate(toDateStr(current));
        setExpandedId(null);
    }

    function goForward() {
        if (!selectedDate) return; // Already on today
        const current = new Date(selectedDate + "T00:00:00");
        current.setDate(current.getDate() + 1);
        const todayStr = toDateStr(new Date());
        setSelectedDate(toDateStr(current) === todayStr ? null : toDateStr(current));
        setExpandedId(null);
    }

    function goToday() {
        setSelectedDate(null);
        setExpandedId(null);
    }

    function handleCopy() {
        if (data) {
            copyToClipboard(data);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    const isToday = !selectedDate;

    // --- Loading skeleton ---
    if (loading) {
        return (
            <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6 animate-pulse">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-1.5 h-5 rounded-full bg-teal-500/30" />
                    <div className="h-5 w-48 bg-white/8 rounded-lg" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-white/[0.03] rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    // --- Error state ---
    if (error) {
        return (
            <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-1.5 h-5 rounded-full bg-red-500/50" />
                    <h3 className="text-lg font-semibold text-white/85 tracking-tight">Hourly Breakdown</h3>
                </div>
                <p className="text-sm text-red-400/70">Failed to load hourly data: {error}</p>
            </div>
        );
    }

    const noData = !data || data.creators.length === 0;
    const hours = noData ? [] : Array.from({ length: data.currentHour + 1 }, (_, i) => i);

    return (
        <div className="glass-panel rounded-3xl border-t border-t-white/12 border-l border-l-white/8 p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-teal-400 to-teal-600 shadow-[0_0_8px_rgba(13,148,136,0.3)]" />
                    <h3 className="text-lg font-semibold text-white/85 tracking-tight">Hourly Breakdown</h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* Date navigation */}
                    <div className="flex items-center glass-inset rounded-xl overflow-hidden">
                        <button onClick={goBack} className="px-2 py-1.5 hover:bg-white/5 transition-colors" title="Previous day">
                            <ChevronLeft size={14} className="text-white/50" />
                        </button>
                        <button
                            onClick={goToday}
                            className={`px-3 py-1.5 text-[11px] font-medium transition-colors min-w-[90px] text-center ${isToday ? "text-teal-400" : "text-white/60 hover:text-white/80"}`}
                        >
                            {formatDateLabel(selectedDate)}
                        </button>
                        <button
                            onClick={goForward}
                            disabled={isToday}
                            className="px-2 py-1.5 hover:bg-white/5 transition-colors disabled:opacity-20"
                            title="Next day"
                        >
                            <ChevronRight size={14} className="text-white/50" />
                        </button>
                    </div>
                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        className="glass-button px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
                        title="Copy to clipboard"
                    >
                        {copied ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
                        <span className="text-[10px] font-medium">{copied ? "Copied" : "Copy"}</span>
                    </button>
                    {/* Export */}
                    <button
                        onClick={() => data && exportCsv(data, selectedDate)}
                        className="glass-button px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
                        title="Export as CSV"
                    >
                        <Download size={12} />
                        <span className="text-[10px] font-medium">Export</span>
                    </button>
                    <div className="glass-inset px-3 py-1 rounded-xl">
                        <span className="text-[10px] text-white/40 font-mono tracking-wider">UK TIME</span>
                    </div>
                </div>
            </div>

            {/* Empty state */}
            {noData ? (
                <p className="text-sm text-white/30">
                    {isToday
                        ? "No hourly data yet today. Revenue will appear here as transactions come in."
                        : `No data for ${formatDateLabel(selectedDate)}.`}
                </p>
            ) : (
                /* Table */
                <div className="overflow-x-auto custom-scrollbar rounded-2xl glass-inset p-1">
                    <table className="w-full text-sm border-separate border-spacing-y-1">
                        <thead>
                            <tr>
                                <th className={`text-left text-white/35 text-[10px] font-semibold uppercase tracking-wider pb-2 px-3 sticky left-0 z-10 min-w-[140px] ${stickyCol}`}>
                                    Model
                                </th>
                                {hours.map((h) => (
                                    <th key={h} className="text-center text-white/25 text-[10px] font-mono pb-2 px-1 min-w-[52px]">
                                        {formatHour(h)}
                                    </th>
                                ))}
                                <th className={`text-right text-white/35 text-[10px] font-semibold uppercase tracking-wider pb-2 px-3 sticky right-0 z-10 min-w-[80px] ${stickyCol}`}>
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {data!.creators.map((creator) => {
                                const isExpanded = expandedId === creator.id;
                                return (
                                    <ModelRow
                                        key={creator.id}
                                        creator={creator}
                                        hours={hours}
                                        isExpanded={isExpanded}
                                        onToggle={() => setExpandedId(isExpanded ? null : creator.id)}
                                        hoursCount={data!.currentHour + 1}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Hint */}
            {!noData && (
                <p className="text-[10px] text-white/20 mt-3 px-1">
                    Click a model row to see chatter breakdown{!isToday && " \u00b7 Viewing historical data"}
                </p>
            )}
        </div>
    );
}

function ModelRow({
    creator,
    hours,
    isExpanded,
    onToggle,
    hoursCount,
}: {
    creator: CreatorHourly;
    hours: number[];
    isExpanded: boolean;
    onToggle: () => void;
    hoursCount: number;
}) {
    return (
        <>
            <tr className="group cursor-pointer" onClick={onToggle}>
                <td className={`py-2.5 px-3 sticky left-0 z-10 rounded-l-xl ${stickyCol} group-hover:bg-white/[0.03] transition-colors`}>
                    <div className="flex items-center gap-2.5">
                        <ChevronDown
                            size={12}
                            className={`text-white/30 transition-transform shrink-0 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                        />
                        {creator.avatarUrl ? (
                            <img
                                src={`/api/proxy-media?url=${encodeURIComponent(creator.avatarUrl)}`}
                                alt={creator.name}
                                className="w-7 h-7 rounded-full object-cover border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                            />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-[10px] font-bold border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                                {creator.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-white/75 font-medium text-xs truncate max-w-[90px]">
                            {creator.name}
                        </span>
                    </div>
                </td>
                {creator.hourly.map((amount, i) => (
                    <td key={i} className={`text-center py-2.5 px-1 text-xs font-mono rounded-lg transition-all ${cellStyle(amount, creator.hourlyTarget)}`}>
                        {amount > 0 ? `$${amount.toFixed(0)}` : "\u2013"}
                    </td>
                ))}
                <td className={`text-right py-2.5 px-3 sticky right-0 z-10 rounded-r-xl ${stickyCol} group-hover:bg-white/[0.03] transition-colors`}>
                    <span className="text-white/90 font-semibold text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                        ${creator.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </td>
            </tr>
            {isExpanded && (
                <ChatterHourlyDrilldown
                    creatorId={creator.id}
                    creatorName={creator.name}
                    hoursCount={hoursCount}
                    onClose={onToggle}
                />
            )}
        </>
    );
}

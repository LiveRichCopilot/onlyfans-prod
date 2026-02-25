"use client";

import { useState, useEffect } from "react";

type ChatterHour = {
    email: string;
    name: string | null;
    hoursActive: boolean[];
    hourlyScores: (number | null)[];
    hourlyDetails: ({
        totalScore: number;
        slaScore: number;
        followupScore: number;
        triggerScore: number;
        qualityScore: number;
        revenueScore: number;
        detectedArchetype: string | null;
        mistakeTags: string[];
        strengthTags: string[];
        aiNotes: string | null;
    } | null)[];
    totalScore: number;
    hoursWorked: number;
};

type DrilldownData = {
    currentHour: number;
    chatters: ChatterHour[];
};

function scoreColor(score: number | null) {
    if (score === null) return "text-white/10";
    if (score >= 80) return "text-teal-400 bg-teal-500/10 border border-teal-500/15";
    if (score >= 60) return "text-amber-400 bg-amber-500/10 border border-amber-500/15";
    if (score >= 40) return "text-orange-400 bg-orange-500/10 border border-orange-500/15";
    return "text-red-400 bg-red-500/10 border border-red-500/15";
}

function avgScoreColor(score: number) {
    if (score >= 80) return "text-teal-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
}

function formatHour(hour: number) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "a" : "p";
    return `${h}${ampm}`;
}

const stickyCol = "backdrop-blur-[40px] bg-[rgba(5,5,8,0.85)]";

export function ChatterHourlyDrilldown({
    creatorId,
    creatorName,
    hoursCount,
    onClose,
}: {
    creatorId: string;
    creatorName: string;
    hoursCount: number;
    onClose: () => void;
}) {
    const [data, setData] = useState<DrilldownData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/creators/${creatorId}/chatter-hours`)
            .then((res) => {
                if (!res.ok) throw new Error(`API ${res.status}`);
                return res.json();
            })
            .then((d) => {
                if (d.error) throw new Error(d.error);
                setData(d);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, [creatorId]);

    const hours = Array.from({ length: hoursCount }, (_, i) => i);

    if (loading) {
        return (
            <tr>
                <td colSpan={hoursCount + 2} className="px-3 py-3">
                    <div className="bg-teal-500/[0.03] rounded-xl p-4 border border-teal-500/10 animate-pulse">
                        <div className="h-4 w-48 bg-white/8 rounded mb-2" />
                        <div className="h-8 bg-white/[0.03] rounded-lg" />
                    </div>
                </td>
            </tr>
        );
    }

    if (error) {
        return (
            <tr>
                <td colSpan={hoursCount + 2} className="px-3 py-3">
                    <div className="bg-red-500/[0.03] rounded-xl p-4 border border-red-500/10">
                        <p className="text-xs text-red-400/70">Failed to load chatters: {error}</p>
                    </div>
                </td>
            </tr>
        );
    }

    if (!data || data.chatters.length === 0) {
        return (
            <tr>
                <td colSpan={hoursCount + 2} className="px-3 py-3">
                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                        <p className="text-xs text-white/30">No chatters tracked for {creatorName} today.</p>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <>
            {data.chatters.map((chatter) => (
                <tr key={chatter.email} className="group/chatter">
                    {/* Chatter name - indented under model */}
                    <td className={`py-2 px-3 sticky left-0 z-10 ${stickyCol}`}>
                        <div className="flex items-center gap-2 pl-4">
                            <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[8px] font-bold text-white/40 border border-white/8">
                                {(chatter.name || chatter.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <span className="text-white/50 text-[11px] font-medium truncate block max-w-[90px]">
                                    {chatter.name || chatter.email.split("@")[0]}
                                </span>
                                <span className="text-white/20 text-[9px] block">
                                    {chatter.hoursWorked}h on shift
                                </span>
                            </div>
                        </div>
                    </td>
                    {/* Hourly score cells */}
                    {hours.map((h) => {
                        const score = chatter.hourlyScores[h];
                        const active = chatter.hoursActive[h];
                        const detail = chatter.hourlyDetails[h];

                        if (!active) {
                            return (
                                <td key={h} className="text-center py-2 px-1 text-[10px] font-mono text-white/8">
                                    &ndash;
                                </td>
                            );
                        }

                        return (
                            <td
                                key={h}
                                className={`text-center py-2 px-1 text-[10px] font-mono rounded-md transition-all ${scoreColor(score)}`}
                                title={detail ? `SLA: ${detail.slaScore} | Follow-up: ${detail.followupScore} | Trigger: ${detail.triggerScore} | Quality: ${detail.qualityScore} | Revenue: ${detail.revenueScore}${detail.detectedArchetype ? ` | Style: ${detail.detectedArchetype}` : ""}${detail.aiNotes ? `\n${detail.aiNotes}` : ""}` : "On shift (no score yet)"}
                            >
                                {score !== null ? score : <span className="text-white/20">...</span>}
                            </td>
                        );
                    })}
                    {/* Average score */}
                    <td className={`text-right py-2 px-3 sticky right-0 z-10 ${stickyCol}`}>
                        <span className={`font-semibold text-xs ${avgScoreColor(chatter.totalScore)}`}>
                            {chatter.totalScore > 0 ? chatter.totalScore : "\u2013"}
                        </span>
                    </td>
                </tr>
            ))}
            {/* Separator row */}
            <tr>
                <td colSpan={hoursCount + 2} className="py-0.5" />
            </tr>
        </>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";

type Suggestion = {
    id: string;
    ofapiMediaId: string;
    fileType: string;
    title: string | null;
    description: string | null;
    tags: string[];
    priceBand: string | null;
    intensity: string | null;
    matchScore: number;
    matchedTags: string[];
    alreadySent: boolean;
};

type Props = {
    fanOfapiId: string;
    creatorId: string;
};

const INTENSITY_COLORS: Record<string, string> = {
    tease: "text-blue-400 bg-blue-500/10",
    soft: "text-pink-400 bg-pink-500/10",
    medium: "text-orange-400 bg-orange-500/10",
    explicit: "text-red-400 bg-red-500/10",
};

const PRICE_COLORS: Record<string, string> = {
    low: "text-white/50",
    mid: "text-amber-400",
    high: "text-orange-400",
    premium: "text-red-400",
};

export function ContentSuggestions({ fanOfapiId, creatorId }: Props) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalTagged, setTotalTagged] = useState(0);

    const fetchSuggestions = useCallback(() => {
        if (!fanOfapiId || !creatorId) return;
        setLoading(true);
        fetch(`/api/inbox/content-match?fanOfapiId=${fanOfapiId}&creatorId=${creatorId}`)
            .then((r) => r.json())
            .then((data) => {
                setSuggestions(data.suggestions || []);
                setTotalTagged(data.totalTagged || 0);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [fanOfapiId, creatorId]);

    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);

    if (loading) {
        return (
            <div className="space-y-2 animate-pulse">
                <div className="h-16 rounded-lg bg-white/[0.04]" />
                <div className="h-16 rounded-lg bg-white/[0.04]" />
            </div>
        );
    }

    if (totalTagged === 0) {
        return (
            <div className="text-center py-4">
                <p className="text-white/30 text-xs">No tagged vault content yet</p>
                <p className="text-white/20 text-[10px] mt-1">Tag vault media to enable smart suggestions</p>
            </div>
        );
    }

    if (suggestions.length === 0) {
        return (
            <div className="text-center py-4">
                <p className="text-white/30 text-xs">No matching content for this fan</p>
                <p className="text-white/20 text-[10px] mt-1">{totalTagged} vault items tagged</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="text-[10px] font-bold tracking-widest text-purple-400 px-1">
                SUGGESTED FOR THIS FAN
            </div>
            {suggestions.slice(0, 5).map((s) => (
                <div
                    key={s.id}
                    className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 hover:bg-white/[0.05] transition-colors"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="text-white/80 text-xs font-medium truncate">
                                {s.title || `${s.fileType} content`}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {s.matchedTags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-bold text-amber-400">
                                {Math.round(s.matchScore * 10)}%
                            </span>
                            {s.intensity && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${INTENSITY_COLORS[s.intensity] || ""}`}>
                                    {s.intensity}
                                </span>
                            )}
                        </div>
                    </div>
                    {s.alreadySent && (
                        <div className="mt-1.5 text-[10px] text-red-400 font-medium">
                            Already sent to this fan
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Chat } from "./types";

type StrikeZone = "green" | "yellow" | "red";

type HintsData = {
    version: string;
    strikeZone: StrikeZone;
    strikeZoneReason: string;
    buyCue: {
        detected: boolean;
        quote: string;
        meaning: string;
    };
    personalBridge: {
        detected: boolean;
        fact: string;
        value: string;
        suggestion: string;
    };
    objectionSniper: {
        detected: boolean;
        objection: string;
        rebuttals: string[];
    };
    draftMessage: string;
    confidence: number;
    contextQuality: "rich" | "partial" | "minimal";
    missingContext: string[];
    isLowConfidence: boolean;
};

type Props = {
    chat: Chat;
    onSuggestMessage: (text: string) => void;
};

const ZONE_CONFIG: Record<StrikeZone, { label: string; color: string; bg: string; glow: string }> = {
    green: {
        label: "PITCH NOW",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        glow: "shadow-[0_0_12px_rgba(52,211,153,0.3)]",
    },
    yellow: {
        label: "WARM UP",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        glow: "shadow-[0_0_12px_rgba(251,191,36,0.3)]",
    },
    red: {
        label: "NOT READY",
        color: "text-red-400",
        bg: "bg-red-500/10",
        glow: "shadow-[0_0_12px_rgba(248,113,113,0.3)]",
    },
};

export function ClosingHints({ chat, onSuggestMessage }: Props) {
    const [hints, setHints] = useState<HintsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rateLimited, setRateLimited] = useState(false);

    const creatorId = chat?._creatorId;
    const fanOfapiId = chat?.withUser?.id;

    const fetchHints = useCallback(() => {
        if (!creatorId || !fanOfapiId) return;
        setLoading(true);
        setError(null);
        setRateLimited(false);

        fetch("/api/inbox/ai-hints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                creatorId,
                chatId: chat.id,
                fanOfapiId,
            }),
        })
            .then((r) => {
                if (r.status === 429) {
                    setRateLimited(true);
                    return r.json();
                }
                return r.json();
            })
            .then((data) => {
                if (data.error && !data.hints) {
                    setError(data.error);
                } else if (data.hints) {
                    setHints(data.hints);
                }
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to fetch hints");
                setLoading(false);
            });
    }, [creatorId, fanOfapiId, chat?.id]);

    useEffect(() => {
        fetchHints();
    }, [fetchHints]);

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="h-16 rounded-xl bg-white/[0.04]" />
                <div className="h-12 rounded-xl bg-white/[0.04]" />
                <div className="h-12 rounded-xl bg-white/[0.04]" />
                <div className="h-10 rounded-xl bg-white/[0.04]" />
            </div>
        );
    }

    if (error && !hints) {
        return (
            <div className="text-center py-6">
                <p className="text-white/30 text-sm">{error}</p>
                <button
                    onClick={fetchHints}
                    className="mt-2 text-xs text-[#2d786e] hover:text-[#3a9a8e] transition-colors"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (!hints) {
        return (
            <div className="text-center py-6">
                <button
                    onClick={fetchHints}
                    className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors"
                >
                    Generate Closing Hints
                </button>
                <p className="text-white/20 text-xs mt-2">AI-powered sales coaching</p>
            </div>
        );
    }

    const zone = ZONE_CONFIG[hints.strikeZone];
    const isLow = hints.isLowConfidence;

    return (
        <div className="space-y-4">
            {/* Low confidence warning */}
            {isLow && (
                <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/40 text-xs">
                    Low confidence — limited data on this fan. Treat as suggestions, not instructions.
                    {hints.missingContext.length > 0 && (
                        <span className="block mt-1 text-white/25">
                            Missing: {hints.missingContext.map(m => m.replace(/_/g, " ")).join(", ")}
                        </span>
                    )}
                </div>
            )}

            {/* Strike Zone */}
            <div className={`rounded-xl ${zone.bg} ${isLow ? "" : zone.glow} border border-white/[0.06] p-3`}>
                <div className="flex items-center gap-3">
                    <div
                        className={`w-4 h-4 rounded-full ${
                            hints.strikeZone === "green"
                                ? "bg-emerald-400"
                                : hints.strikeZone === "yellow"
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                        } ${isLow ? "opacity-50" : ""}`}
                    />
                    <div className="flex-1">
                        <div className={`text-xs font-bold tracking-widest ${zone.color}`}>
                            {isLow ? "LIKELY " : ""}{zone.label}
                        </div>
                        <p className="text-white/50 text-xs mt-0.5">{hints.strikeZoneReason}</p>
                    </div>
                    <button
                        onClick={fetchHints}
                        disabled={rateLimited}
                        className={`transition-colors ${rateLimited ? "text-white/10" : "text-white/20 hover:text-white/50"}`}
                        title={rateLimited ? "Rate limited — wait 10s" : "Refresh hints"}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Buy Cue */}
            {hints.buyCue.detected && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="text-[10px] font-bold tracking-widest text-purple-400 mb-1.5">
                        BUY CUE DETECTED
                    </div>
                    {hints.buyCue.quote && (
                        <p className="text-white/70 text-sm italic">
                            &ldquo;{hints.buyCue.quote}&rdquo;
                        </p>
                    )}
                    <p className="text-white/40 text-xs mt-1">{hints.buyCue.meaning}</p>
                </div>
            )}

            {/* Personal Bridge */}
            {hints.personalBridge.detected && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="text-[10px] font-bold tracking-widest text-blue-400 mb-1.5">
                        PERSONAL BRIDGE
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-medium">
                            {hints.personalBridge.fact}
                        </span>
                        <span className="text-white/50 text-xs">{hints.personalBridge.value}</span>
                    </div>
                    <p className="text-white/60 text-sm">{hints.personalBridge.suggestion}</p>
                </div>
            )}

            {/* Objection Sniper */}
            {hints.objectionSniper.detected && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="text-[10px] font-bold tracking-widest text-orange-400 mb-2">
                        OBJECTION: {hints.objectionSniper.objection.toUpperCase()}
                    </div>
                    <div className="space-y-1.5">
                        {hints.objectionSniper.rebuttals.map((rebuttal, i) => (
                            <button
                                key={i}
                                onClick={() => onSuggestMessage(rebuttal)}
                                className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-orange-500/10 border border-white/[0.06] hover:border-orange-500/20 text-white/70 text-sm transition-all group"
                            >
                                <span className="group-hover:text-orange-300 transition-colors">
                                    {rebuttal}
                                </span>
                                <span className="float-right text-white/20 group-hover:text-orange-400 text-xs mt-0.5">
                                    tap to use
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Draft Message */}
            {hints.draftMessage && (
                <button
                    onClick={() => onSuggestMessage(hints.draftMessage)}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-3 text-left hover:from-amber-500/15 hover:to-orange-500/15 transition-all group"
                >
                    <div className="flex items-center gap-2 mb-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-widest text-amber-400">
                            {isLow ? "SUGGESTED MESSAGE" : "RECOMMENDED MESSAGE"}
                        </span>
                    </div>
                    <p className="text-white/70 text-sm group-hover:text-white/90 transition-colors">
                        {hints.draftMessage}
                    </p>
                    <p className="text-white/20 text-xs mt-1.5 group-hover:text-amber-400/50 transition-colors">
                        Tap to use this message
                    </p>
                </button>
            )}

            {/* Context quality + confidence footer */}
            <div className="flex items-center justify-between text-xs text-white/20 px-1">
                <div className="flex items-center gap-2">
                    <span>Confidence: {Math.round(hints.confidence * 100)}%</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        hints.contextQuality === "rich" ? "bg-emerald-500/10 text-emerald-400" :
                        hints.contextQuality === "partial" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                    }`}>
                        {hints.contextQuality}
                    </span>
                </div>
                <button
                    onClick={fetchHints}
                    disabled={rateLimited}
                    className={rateLimited ? "text-white/10" : "text-[#2d786e] hover:text-[#3a9a8e] transition-colors"}
                >
                    {rateLimited ? "Wait..." : "Refresh"}
                </button>
            </div>
        </div>
    );
}

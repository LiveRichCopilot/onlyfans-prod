"use client";

import { useState, useEffect } from "react";
import type { ClassificationResult } from "@/lib/ai-classifier";

type Props = {
    creatorId?: string;
    chatId?: string;
    fanOfapiId?: string;
    fanName?: string;
    lastAnalyzedAt?: string | null;
    messagesAnalyzed?: number | null;
    persistedResult?: ClassificationResult | null;
    onClassified?: () => void;
};

function intentColor(tag: string): string {
    if (tag.includes("buy") || tag === "high_intent") return "#2DD4BF"; // teal
    if (tag.includes("custom") || tag.includes("escalation")) return "#A78BFA"; // violet
    if (tag.includes("price") || tag.includes("discount")) return "#FBBF24"; // yellow
    if (tag.includes("churn") || tag.includes("boundary")) return "#EF4444"; // red
    if (tag.includes("trust") || tag.includes("attention")) return "#F472B6"; // pink
    return "#94A3B8"; // gray
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export function AiClassifyButton({ creatorId, chatId, fanOfapiId, fanName, lastAnalyzedAt, messagesAnalyzed, persistedResult, onClassified }: Props) {
    const [classifying, setClassifying] = useState(false);
    const [result, setResult] = useState<ClassificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Reset local state when switching fans (prevents cross-contamination)
    useEffect(() => {
        setResult(null);
        setError(null);
        setClassifying(false);
    }, [fanOfapiId]);

    // Show persisted result from DB immediately, override with fresh result after classify
    const displayResult = result || persistedResult || null;

    const canClassify = Boolean(creatorId && chatId && fanOfapiId);
    const hasBeenAnalyzed = !!lastAnalyzedAt;

    const handleClassify = async () => {
        if (!canClassify) return;
        setClassifying(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/api/inbox/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creatorId, chatId, fanOfapiId, fanName }),
            });

            // Handle non-JSON responses (timeouts, 500 HTML pages, etc.)
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                const text = await res.text();
                setError(res.status === 504 ? "Timed out — too many messages. Try again." : `Server error (${res.status})`);
                console.error("[Classify] Non-JSON response:", res.status, text.slice(0, 200));
                setClassifying(false);
                return;
            }

            const data = await res.json();

            if (data.classified && data.result) {
                setResult(data.result);
                onClassified?.(); // Refresh sidebar data
            } else {
                const debugInfo = data.debug ? ` [${data.debug.fanMessagesCount} fan msgs, ${data.debug.apiCallsMade} calls, ${Math.round((data.debug.runtimeMs || 0) / 1000)}s, key=${data.debug.openAiKeySet}]` : "";
                setError((data.reason || data.error || "Classification failed") + debugInfo);
                if (data.debug) console.log("[Classify debug]", data.debug);
            }
        } catch (e: any) {
            setError(e.message || "Failed to classify");
        }
        setClassifying(false);
    };

    return (
        <div>
            {/* Classify / Update button */}
            <button
                onClick={handleClassify}
                disabled={!canClassify || classifying}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    classifying
                        ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                        : displayResult
                            ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                            : "bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20"
                } disabled:opacity-40`}
            >
                {classifying ? (
                    <>
                        <div className="w-4 h-4 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
                        <span>Scanning chat history...</span>
                    </>
                ) : displayResult
                    ? "Update analysis"
                    : hasBeenAnalyzed ? "Update analysis" : "Analyze Fan with AI"}
            </button>

            {/* Loading subtitle */}
            {classifying && (
                <p className="text-[10px] text-violet-400/50 text-center mt-1.5">Reading messages and building fan profile — takes 5-15s</p>
            )}

            {/* Analysis metadata (only when no card is showing) */}
            {hasBeenAnalyzed && !displayResult && !classifying && (
                <p className="text-[10px] text-white/25 text-center mt-1.5">
                    {messagesAnalyzed ? `${messagesAnalyzed} messages analyzed` : "Analyzed"} · {timeAgo(lastAnalyzedAt!)}
                </p>
            )}

            {/* Error */}
            {error && (
                <p className="text-[11px] text-red-400/70 mt-1.5 text-center">{error}</p>
            )}

            {/* Classification result card (purple) — shows from DB or fresh analysis */}
            {displayResult && (
                <div className="mt-3 border border-violet-500/20 rounded-xl p-3 bg-violet-500/5 space-y-3">
                    {/* Summary */}
                    <p className="text-[12px] text-white/70 leading-relaxed">{displayResult.summary}</p>

                    {/* Fan type + tone + confidence */}
                    <div className="flex flex-wrap gap-1.5">
                        {displayResult.fanType && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                                {displayResult.fanType}
                            </span>
                        )}
                        {displayResult.tonePreference && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                                {displayResult.tonePreference}
                            </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                            {Math.round(displayResult.confidence * 100)}% confident
                        </span>
                    </div>

                    {/* Do Not Forget bullets */}
                    {displayResult.doNotForget.length > 0 && (
                        <div>
                            <div className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-wider mb-1">Do Not Forget</div>
                            <ul className="space-y-0.5">
                                {displayResult.doNotForget.map((item, i) => (
                                    <li key={i} className="text-[11px] text-white/60 flex items-start gap-1.5">
                                        <span className="text-amber-400 mt-0.5">•</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Personal facts (top-level) */}
                    {(displayResult.nickname || displayResult.job || displayResult.location || displayResult.relationshipStatus || displayResult.pets.length > 0 || displayResult.hobbies.length > 0) && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Personal Info</div>
                            <div className="grid grid-cols-2 gap-1">
                                {displayResult.nickname && <InfoChip label="Name" value={displayResult.nickname} />}
                                {displayResult.job && <InfoChip label="Job" value={displayResult.job} />}
                                {displayResult.location && <InfoChip label="Location" value={displayResult.location} />}
                                {displayResult.relationshipStatus && <InfoChip label="Status" value={displayResult.relationshipStatus} />}
                                {displayResult.pets.length > 0 && <InfoChip label="Pets" value={displayResult.pets.join(", ")} />}
                                {displayResult.hobbies.length > 0 && <InfoChip label="Hobbies" value={displayResult.hobbies.join(", ")} />}
                            </div>
                        </div>
                    )}

                    {/* Suggested questions (when facts are missing) */}
                    {displayResult.suggestedQuestions.length > 0 && (
                        <div>
                            <div className="text-[9px] text-cyan-400/60 font-semibold uppercase tracking-wider mb-1">Ask Next</div>
                            <ul className="space-y-0.5">
                                {displayResult.suggestedQuestions.map((q, i) => (
                                    <li key={i} className="text-[11px] text-cyan-400/70 italic">&ldquo;{q}&rdquo;</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Intent tags */}
                    {displayResult.intentTags.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Intent Signals</div>
                            <div className="space-y-1">
                                {displayResult.intentTags
                                    .sort((a, b) => b.confidence - a.confidence)
                                    .map((t, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span
                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0"
                                                style={{
                                                    color: intentColor(t.tag),
                                                    borderColor: intentColor(t.tag) + "40",
                                                    backgroundColor: intentColor(t.tag) + "15",
                                                }}
                                            >
                                                {t.tag.replace(/_/g, " ")}
                                            </span>
                                            <span className="text-[10px] text-white/30 truncate italic">
                                                &ldquo;{t.evidence}&rdquo;
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Emotional drivers */}
                    {displayResult.emotionalDrivers.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Emotional Drivers</div>
                            <div className="flex flex-wrap gap-1">
                                {displayResult.emotionalDrivers.map(d => (
                                    <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        {d}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Content preferences */}
                    {displayResult.contentPreferences.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Content Preferences</div>
                            <div className="flex flex-wrap gap-1">
                                {displayResult.contentPreferences.map(k => (
                                    <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                        {k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Analysis metadata */}
                    {displayResult.analysis && (
                        <div className="pt-2 border-t border-white/[0.06] flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="text-[9px] text-white/20">{displayResult.analysis.totalMessagesUsed} msgs analyzed</span>
                            {displayResult.analysis.apiCallsMade > 0 && (
                                <span className="text-[9px] text-white/20">{displayResult.analysis.apiCallsMade} API calls</span>
                            )}
                            {displayResult.analysis.runtimeMs > 0 && (
                                <span className="text-[9px] text-white/20">{Math.round(displayResult.analysis.runtimeMs / 1000)}s runtime</span>
                            )}
                            {displayResult.analysis.isIncremental && <span className="text-[9px] text-teal-400/40">incremental</span>}
                            {lastAnalyzedAt && (
                                <span className="text-[9px] text-white/20">{timeAgo(lastAnalyzedAt)}</span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function InfoChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-white/30">{label}: </span>
            <span className="text-white/60">{value}</span>
        </div>
    );
}

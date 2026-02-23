"use client";

import { useState } from "react";

type ClassificationResult = {
    fanType: string | null;
    tonePreference: string | null;
    intentTags: { tag: string; confidence: number; evidence: string }[];
    emotionalDrivers: string[];
    buyingKeywords: string[];
    confidence: number;
    summary: string;
};

type Props = {
    creatorId?: string;
    chatId?: string;
    fanOfapiId?: string;
    fanName?: string;
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

export function AiClassifyButton({ creatorId, chatId, fanOfapiId, fanName, onClassified }: Props) {
    const [classifying, setClassifying] = useState(false);
    const [result, setResult] = useState<ClassificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const canClassify = Boolean(creatorId && chatId && fanOfapiId);

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
                setError(data.reason || data.error || "Classification failed");
            }
        } catch (e: any) {
            setError(e.message || "Failed to classify");
        }
        setClassifying(false);
    };

    return (
        <div>
            {/* Classify button */}
            <button
                onClick={handleClassify}
                disabled={!canClassify || classifying}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    classifying
                        ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                        : result
                            ? "bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
                            : "bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20"
                } disabled:opacity-40`}
            >
                {classifying ? (
                    <>
                        <div className="w-4 h-4 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
                        <span>Scanning chat history...</span>
                    </>
                ) : result ? "Re-analyze with AI" : "Analyze Fan with AI"}
            </button>
            {classifying && (
                <p className="text-[10px] text-violet-400/50 text-center mt-1.5">Reading messages and building fan profile — takes 10-30s</p>
            )}

            {/* Error */}
            {error && (
                <p className="text-[11px] text-red-400/70 mt-1.5 text-center">{error}</p>
            )}

            {/* Classification result card */}
            {result && (
                <div className="mt-3 border border-violet-500/20 rounded-xl p-3 bg-violet-500/5 space-y-3">
                    {/* Summary */}
                    <p className="text-[12px] text-white/70 leading-relaxed">{result.summary}</p>

                    {/* Fan type + tone */}
                    <div className="flex gap-2">
                        {result.fanType && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                                {result.fanType}
                            </span>
                        )}
                        {result.tonePreference && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                                {result.tonePreference}
                            </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                            {Math.round(result.confidence * 100)}% confident
                        </span>
                    </div>

                    {/* Intent tags */}
                    {result.intentTags.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Intent Signals</div>
                            <div className="space-y-1">
                                {result.intentTags
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
                    {result.emotionalDrivers.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Emotional Drivers</div>
                            <div className="flex flex-wrap gap-1">
                                {result.emotionalDrivers.map(d => (
                                    <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        {d}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Buying keywords */}
                    {result.buyingKeywords.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Buying Keywords</div>
                            <div className="flex flex-wrap gap-1">
                                {result.buyingKeywords.map(k => (
                                    <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                        {k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

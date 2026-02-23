"use client";

type QAReview = {
    controlScore: number;
    tensionScore: number;
    valueScore: number;
    personalizationScore: number;
    compliancePass: boolean;
    mistakeTags: string[];
    strengthTags: string[];
    agentStyle: string | null;
    outcome: string | null;
    notes: string | null;
};

type Props = {
    review: QAReview;
};

const SCORE_LABELS: Record<string, string> = {
    controlScore: "Control",
    tensionScore: "Tension",
    valueScore: "Value",
    personalizationScore: "Personal",
};

export function QAScoreCard({ review }: Props) {
    const totalScore =
        review.controlScore +
        review.tensionScore +
        review.valueScore +
        review.personalizationScore;
    const maxScore = 20;
    const pct = Math.round((totalScore / maxScore) * 100);

    const scoreColor = pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400";

    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold tracking-widest text-purple-400">
                    QA SCORE
                </div>
                <div className={`text-lg font-black ${scoreColor}`}>
                    {totalScore}/{maxScore}
                </div>
            </div>

            {/* Score bars */}
            <div className="space-y-2">
                {Object.entries(SCORE_LABELS).map(([key, label]) => {
                    const score = (review as any)[key] as number;
                    const barPct = (score / 5) * 100;
                    const barColor =
                        score >= 4 ? "bg-emerald-500" : score >= 2 ? "bg-amber-500" : "bg-red-500";
                    return (
                        <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-white/50 w-16">{label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                                <div
                                    className={`h-full rounded-full ${barColor} transition-all`}
                                    style={{ width: `${barPct}%` }}
                                />
                            </div>
                            <span className="text-xs text-white/60 w-4 text-right">{score}</span>
                        </div>
                    );
                })}
            </div>

            {/* Compliance */}
            <div className={`text-xs px-2 py-1 rounded ${review.compliancePass ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                Compliance: {review.compliancePass ? "PASS" : "FAIL"}
            </div>

            {/* Tags */}
            {review.strengthTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {review.strengthTags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                            {tag.replace(/_/g, " ")}
                        </span>
                    ))}
                </div>
            )}
            {review.mistakeTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {review.mistakeTags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">
                            {tag.replace(/_/g, " ")}
                        </span>
                    ))}
                </div>
            )}

            {/* Notes */}
            {review.notes && (
                <p className="text-xs text-white/40 italic">{review.notes}</p>
            )}
        </div>
    );
}

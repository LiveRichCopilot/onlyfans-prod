"use client";

import { useState, useEffect } from "react";

/**
 * HustleMeter — compact score widget for the NavBar.
 * Shows the current user's live performance score with color coding.
 * Green 80+, Yellow 50-79, Red <50
 */
export function HustleMeter() {
    const [score, setScore] = useState<number | null>(null);

    useEffect(() => {
        // Fetch current user's performance
        fetch("/api/inbox/performance")
            .then((r) => r.json())
            .then((data) => {
                if (data.performance?.length > 0) {
                    // Use the highest score across all creator assignments
                    const best = data.performance.reduce(
                        (max: any, r: any) => (r.liveScore > (max?.liveScore || 0) ? r : max),
                        data.performance[0],
                    );
                    setScore(best.liveScore);
                }
            })
            .catch(console.error);

        // Refresh every 5 minutes
        const interval = setInterval(() => {
            fetch("/api/inbox/performance")
                .then((r) => r.json())
                .then((data) => {
                    if (data.performance?.length > 0) {
                        const best = data.performance.reduce(
                            (max: any, r: any) => (r.liveScore > (max?.liveScore || 0) ? r : max),
                            data.performance[0],
                        );
                        setScore(best.liveScore);
                    }
                })
                .catch(console.error);
        }, 300000);

        return () => clearInterval(interval);
    }, []);

    if (score === null) return null;

    const color =
        score >= 80
            ? "text-emerald-400 bg-emerald-500/10"
            : score >= 50
              ? "text-amber-400 bg-amber-500/10"
              : "text-red-400 bg-red-500/10";

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${color} text-xs font-bold`}
            title={`Hustle Score: ${score}/100`}
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {score}
        </div>
    );
}

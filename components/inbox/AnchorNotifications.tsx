"use client";

import React, { useMemo } from "react";

type Fact = {
    key: string;
    value: string;
    confidence: number;
    source: string | null;
    lastConfirmedAt?: string;  // ISO timestamp for freshness filtering
    createdAt?: string;
};

type LifecycleEvent = {
    type: string;
    metadata: any;
    createdAt: string;
};

type Props = {
    facts: Fact[];
    lifecycleEvents?: LifecycleEvent[];
};

// Temporal fact keys that deserve anchor reminders
const TEMPORAL_KEYS: Record<string, { icon: string; template: (val: string) => string }> = {
    pet_sick: {
        icon: "heart",
        template: (v) => `Ask about ${v} before pitching`,
    },
    promise_made: {
        icon: "pin",
        template: (v) => `You promised: "${v}" — follow up on this`,
    },
    birthday: {
        icon: "cake",
        template: (v) => `Birthday coming up (${v}) — send something special`,
    },
    avoid_topic: {
        icon: "alert",
        template: (v) => `Avoid talking about: ${v}`,
    },
    trigger_topic: {
        icon: "zap",
        template: (v) => `Hot button: ${v} — use this to build rapport`,
    },
    favorite_team: {
        icon: "star",
        template: (v) => `Fan of ${v} — check if they played recently`,
    },
    work_schedule: {
        icon: "clock",
        template: (v) => `Works ${v} — time your messages around this`,
    },
    relationship: {
        icon: "heart",
        template: (v) => `Status: ${v} — adjust flirting intensity`,
    },
};

const ICON_MAP: Record<string, React.ReactElement> = {
    heart: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    ),
    pin: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
        </svg>
    ),
    cake: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" /><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" /><path d="M2 21h20" /><path d="M7 8v2" /><path d="M12 8v2" /><path d="M17 8v2" /><path d="M7 4h.01" /><path d="M12 4h.01" /><path d="M17 4h.01" />
        </svg>
    ),
    alert: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    zap: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    ),
    star: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ),
    clock: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    ),
};

export function AnchorNotifications({ facts, lifecycleEvents }: Props) {
    const anchors = useMemo(() => {
        const items: { icon: string; text: string; priority: number; type: "warning" | "info" | "action" }[] = [];

        // Check facts for temporal/actionable items
        // Freshness rule: only show if created within 7 days AND confidence >= 0.5
        // Exception: "avoid_topic" always shown regardless of age (manual entries are permanent)
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const fact of facts) {
            const temporal = TEMPORAL_KEYS[fact.key];
            if (!temporal) continue;

            // Freshness filter
            const isAvoidTopic = fact.key === "avoid_topic";
            const isManual = fact.source === "manual";
            const factAge = fact.lastConfirmedAt
                ? now - new Date(fact.lastConfirmedAt).getTime()
                : fact.createdAt
                    ? now - new Date(fact.createdAt).getTime()
                    : Infinity;

            // Skip stale auto-extracted facts (except avoid_topic which is always relevant)
            if (!isAvoidTopic && !isManual && factAge > sevenDaysMs) continue;
            // Skip low-confidence auto-extracted facts
            if (!isManual && fact.confidence < 0.5) continue;

            const isWarning = isAvoidTopic;
            items.push({
                icon: temporal.icon,
                text: temporal.template(fact.value),
                priority: isWarning ? 0 : 1,
                type: isWarning ? "warning" : fact.key === "trigger_topic" ? "action" : "info",
            });
        }

        // Check lifecycle events for recent promises (last 7 days)
        if (lifecycleEvents) {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            for (const event of lifecycleEvents) {
                if (
                    event.type === "promise_made" &&
                    new Date(event.createdAt).getTime() > sevenDaysAgo
                ) {
                    const promise = event.metadata?.promise || event.metadata?.value || "something";
                    items.push({
                        icon: "pin",
                        text: `You promised: "${promise}" — follow through`,
                        priority: 0,
                        type: "action",
                    });
                }
            }
        }

        // Sort by priority (warnings first)
        return items.sort((a, b) => a.priority - b.priority);
    }, [facts, lifecycleEvents]);

    if (anchors.length === 0) return null;

    const typeColors = {
        warning: "border-red-500/20 bg-red-500/5 text-red-300",
        action: "border-amber-500/20 bg-amber-500/5 text-amber-300",
        info: "border-blue-500/20 bg-blue-500/5 text-blue-300",
    };

    return (
        <div className="space-y-1.5 mb-4">
            {anchors.slice(0, 4).map((anchor, i) => (
                <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${typeColors[anchor.type]}`}
                >
                    <span className="mt-0.5 flex-shrink-0 opacity-70">
                        {ICON_MAP[anchor.icon] || ICON_MAP.star}
                    </span>
                    <span className="leading-relaxed">{anchor.text}</span>
                </div>
            ))}
        </div>
    );
}

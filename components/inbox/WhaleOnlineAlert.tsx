"use client";

import { useState, useEffect, useCallback } from "react";

type WhaleAlert = {
    id: string;
    fanOfapiId: string;
    name: string;
    spend: number;
    lastPurchaseAt: string | null;
    timestamp: string;
};

type Props = {
    creatorId: string;
    onNavigateToFan?: (fanOfapiId: string) => void;
};

export function WhaleOnlineAlert({ creatorId, onNavigateToFan }: Props) {
    const [alerts, setAlerts] = useState<WhaleAlert[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const fetchAlerts = useCallback(() => {
        if (!creatorId || creatorId === "all") return;
        fetch(`/api/inbox/whale-alerts?creatorId=${creatorId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.alerts) setAlerts(data.alerts);
            })
            .catch(console.error);
    }, [creatorId]);

    // Poll every 30 seconds
    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, [fetchAlerts]);

    // Auto-dismiss after 5 minutes
    useEffect(() => {
        if (alerts.length === 0) return;
        const timers = alerts.map((alert) => {
            const age = Date.now() - new Date(alert.timestamp).getTime();
            const remaining = Math.max(0, 5 * 60 * 1000 - age);
            return setTimeout(() => {
                setDismissed((prev) => new Set([...prev, alert.id]));
            }, remaining);
        });
        return () => timers.forEach(clearTimeout);
    }, [alerts]);

    const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

    if (visibleAlerts.length === 0) return null;

    const formatTimeAgo = (ts: string) => {
        const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    const formatDaysAgo = (ts: string | null) => {
        if (!ts) return "never";
        const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
        if (days === 0) return "today";
        if (days === 1) return "yesterday";
        return `${days}d ago`;
    };

    return (
        <div className="space-y-2 mb-3">
            {visibleAlerts.map((alert) => (
                <button
                    key={alert.id}
                    onClick={() => onNavigateToFan?.(alert.fanOfapiId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:from-cyan-500/15 hover:to-blue-500/15 transition-all group animate-in slide-in-from-top-2"
                >
                    <span className="text-2xl flex-shrink-0">🐋</span>
                    <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-white/90 text-sm font-semibold">
                                {alert.name}
                            </span>
                            <span className="text-cyan-400 text-xs font-bold">
                                ${alert.spend.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-white/40 text-xs">
                            Last bought {formatDaysAgo(alert.lastPurchaseAt)} — online {formatTimeAgo(alert.timestamp)}
                        </p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setDismissed((prev) => new Set([...prev, alert.id]));
                        }}
                        className="text-white/20 hover:text-white/50 transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </button>
            ))}
        </div>
    );
}

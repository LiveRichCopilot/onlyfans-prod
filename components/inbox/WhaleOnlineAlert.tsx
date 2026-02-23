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
        <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.06]">
            <span className="text-[10px] text-cyan-400/60 font-semibold flex-shrink-0 uppercase tracking-wider">🐋 Online:</span>
            {visibleAlerts.map((alert) => (
                <button
                    key={alert.id}
                    onClick={() => onNavigateToFan?.(String(alert.fanOfapiId))}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all flex-shrink-0 group"
                >
                    <span className="text-white/90 text-[11px] font-semibold">{alert.name.split(" ")[0]}</span>
                    <span className="text-cyan-400 text-[10px] font-bold">${alert.spend >= 1000 ? `${(alert.spend / 1000).toFixed(1)}k` : alert.spend.toLocaleString()}</span>
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            setDismissed((prev) => new Set([...prev, alert.id]));
                        }}
                        className="text-white/20 hover:text-white/50 transition-colors cursor-pointer"
                    >
                        ×
                    </span>
                </button>
            ))}
        </div>
    );
}

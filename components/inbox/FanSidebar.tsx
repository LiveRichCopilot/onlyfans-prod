"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { InsightsTabs } from "./InsightsTabs";
import { FanPreferences } from "./FanPreferences";
import { FanNotes } from "./FanNotes";
import { FanInfo } from "./FanInfo";
import { PurchaseHistory } from "./PurchaseHistory";
import { AiClassifyButton } from "./AiClassifyButton";
import type { Chat } from "./types";

type Purchase = {
    id: string;
    amount: number;
    type: string;
    date: string;
};

type Intelligence = {
    stage: string | null;
    fanType: string | null;
    tonePreference: string | null;
    priceRange: string | null;
    buyerType: string | null;
    intentScore: number | null;
    timeWasterScore: number | null;
    conversionRate: number | null;
    avgOrderValue: number | null;
    formatPreference: string | null;
    nextBestAction: string | null;
    nextBestActionReason: string | null;
    emotionalDrivers: string | null;
    emotionalNeeds: string | null;
    narrativeSummary: string | null;
    lastMessageAt: string | null;
    followUpDueAt: string | null;
};

type Preference = {
    tag: string;
    weight: number;
    source: string | null;
};

type Fact = {
    key: string;
    value: string;
    confidence: number;
    source: string | null;
};

export type BuyPatterns = {
    favoriteDayOfWeek: string;
    favoriteDayCount: number;
    favoriteHour: string;
    favoriteHourCount: number;
    avgDaysBetweenPurchases: number;
    totalPurchases: number;
    typeBreakdown: { type: string; count: number; total: number }[];
};

export type FanData = {
    found: boolean;
    totalSpend: number;
    lastPaid: string | null;
    lastPurchaseType: string | null;
    lastPurchaseAmount: number | null;
    fanSince: string | null;
    txCount: number;
    purchases: Purchase[];
    intelligence: Intelligence | null;
    preferences: Preference[];
    facts: Fact[];
    buyPatterns: BuyPatterns | null;
};

type Props = {
    chat: Chat;
    width: number;
};

export function FanSidebar({ chat, width }: Props) {
    const [activeTab, setActiveTab] = useState<"insights" | "purchases">("insights");
    const [fanData, setFanData] = useState<FanData | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [classifying, setClassifying] = useState(false);
    const autoClassifiedRef = useRef<string | null>(null); // Track which fan we already auto-classified

    const fanOfapiId = chat?.withUser?.id;
    const creatorId = chat?._creatorId;

    const fetchFanData = useCallback(() => {
        if (!creatorId || !fanOfapiId) {
            setFanData(null);
            return;
        }
        setLoading(true);
        fetch(`/api/inbox/fan-details?creatorId=${creatorId}&fanId=${fanOfapiId}`)
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) setFanData(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [creatorId, fanOfapiId]);

    useEffect(() => {
        fetchFanData();
    }, [fetchFanData, refreshKey]);

    // --- AUTO-CLASSIFY DISABLED for now ---
    // Was killing DB connections by scanning 1000 messages on every sidebar open.
    // TODO: Move to background cron job (Trigger.dev) instead of inline on sidebar open.
    // The "Analyze Fan with AI" button still works for manual deep analysis.

    const handleUpdate = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    return (
        <div
            style={{ width: `${width}px` }}
            className="flex flex-col flex-shrink-0 border-l border-white/[0.06] overflow-y-auto custom-scrollbar p-4 bg-black/30"
        >
            <InsightsTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "insights" ? (
                <div className="space-y-6">
                    {/* Manual AI analysis button — auto-classify disabled to prevent DB overload */}
                    <AiClassifyButton
                        creatorId={creatorId}
                        chatId={chat?.id}
                        fanOfapiId={fanOfapiId}
                        fanName={chat?.withUser?.name}
                        onClassified={handleUpdate}
                    />
                    <FanPreferences
                        preferences={fanData?.preferences || []}
                        intelligence={fanData?.intelligence || null}
                        loading={loading}
                        fanOfapiId={fanOfapiId}
                        creatorId={creatorId}
                        onUpdate={handleUpdate}
                    />
                    <FanNotes
                        facts={fanData?.facts || []}
                        loading={loading}
                        fanOfapiId={fanOfapiId}
                        creatorId={creatorId}
                        onUpdate={handleUpdate}
                    />
                    <FanInfo chat={chat} fanData={fanData} loading={loading} />
                </div>
            ) : (
                <PurchaseHistory
                    creatorId={creatorId}
                    chatId={chat?.id}
                />
            )}
        </div>
    );
}

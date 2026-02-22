"use client";

import { useState, useEffect } from "react";
import { InsightsTabs } from "./InsightsTabs";
import { FanPreferences } from "./FanPreferences";
import { FanNotes } from "./FanNotes";
import { FanInfo } from "./FanInfo";
import { PurchaseHistory } from "./PurchaseHistory";
import type { Chat } from "./types";

type FanData = {
    totalSpend: number;
    lastPaid: string | null;
    fanSince: string | null;
    txCount: number;
    purchases: any[];
};

type Props = {
    chat: Chat;
    width: number;
};

export function FanSidebar({ chat, width }: Props) {
    const [activeTab, setActiveTab] = useState<"insights" | "purchases">("insights");
    const [fanData, setFanData] = useState<FanData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!chat?._creatorId || !chat?.withUser?.id) {
            setFanData(null);
            return;
        }
        setLoading(true);
        fetch(`/api/inbox/fan-details?creatorId=${chat._creatorId}&fanId=${chat.withUser.id}`)
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) setFanData(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [chat?.id, chat?._creatorId, chat?.withUser?.id]);

    return (
        <div
            style={{ width: `${width}px` }}
            className="flex flex-col flex-shrink-0 border-l border-white/[0.06] overflow-y-auto custom-scrollbar p-4 bg-black/30"
        >
            <InsightsTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "insights" ? (
                <div className="space-y-6">
                    <FanPreferences />
                    <FanNotes />
                    <FanInfo chat={chat} fanData={fanData} loading={loading} />
                </div>
            ) : (
                <PurchaseHistory purchases={fanData?.purchases || []} loading={loading} />
            )}
        </div>
    );
}

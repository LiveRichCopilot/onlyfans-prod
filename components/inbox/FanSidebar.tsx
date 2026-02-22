"use client";

import { useState } from "react";
import { InsightsTabs } from "./InsightsTabs";
import { FanPreferences } from "./FanPreferences";
import { FanNotes } from "./FanNotes";
import { FanInfo } from "./FanInfo";
import { PurchaseHistory } from "./PurchaseHistory";
import type { Chat } from "./types";

type Props = {
    chat: Chat;
    width: number;
};

export function FanSidebar({ chat, width }: Props) {
    const [activeTab, setActiveTab] = useState<"insights" | "purchases">("insights");

    return (
        <div
            style={{ width: `${width}px` }}
            className="m-4 ml-0 flex flex-col z-10 glass-panel rounded-3xl overflow-y-auto custom-scrollbar border-white/10 p-6 hidden xl:block shadow-2xl"
        >
            <InsightsTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "insights" ? (
                <div className="space-y-8">
                    <FanPreferences />
                    <FanNotes />
                    <FanInfo chat={chat} />
                </div>
            ) : (
                <PurchaseHistory chat={chat} />
            )}
        </div>
    );
}

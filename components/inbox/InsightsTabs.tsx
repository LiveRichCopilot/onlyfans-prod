"use client";

type TabId = "insights" | "purchases" | "hints";

type Props = {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
};

export type { TabId };

export function InsightsTabs({ activeTab, onTabChange }: Props) {
    return (
        <div className="flex justify-between border-b border-white/[0.08] pb-3 mb-6 sticky top-0 backdrop-blur-xl z-20">
            <button
                onClick={() => onTabChange("insights")}
                className={`pb-3 -mb-3 font-semibold text-sm tracking-wide transition-colors ${activeTab === "insights" ? "text-[#2d786e] border-b-2 border-[#2d786e]" : "text-white/40 hover:text-white"}`}
            >
                Insights
            </button>
            <button
                onClick={() => onTabChange("purchases")}
                className={`pb-3 -mb-3 font-semibold text-sm tracking-wide transition-colors ${activeTab === "purchases" ? "text-purple-400 border-b-2 border-purple-400" : "text-white/40 hover:text-white"}`}
            >
                Purchases
            </button>
            <button
                onClick={() => onTabChange("hints")}
                className={`pb-3 -mb-3 font-semibold text-sm tracking-wide transition-colors ${activeTab === "hints" ? "text-amber-400 border-b-2 border-amber-400" : "text-white/40 hover:text-white"}`}
            >
                Hints
            </button>
        </div>
    );
}

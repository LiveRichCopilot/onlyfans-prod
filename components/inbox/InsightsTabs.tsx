"use client";

type Props = {
    activeTab: "insights" | "purchases";
    onTabChange: (tab: "insights" | "purchases") => void;
};

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
                Purchase History
            </button>
            <button className="text-white/30 hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        </div>
    );
}

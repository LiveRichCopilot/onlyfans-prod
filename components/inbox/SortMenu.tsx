"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

const SORT_VALUES = ["recent", "oldest_activity", "top_spenders", "least_spent", "newest_fans", "oldest_fans"] as const;

type Props = {
    sortBy: string;
    onSortChange: (value: string) => void;
    unreadFirst: boolean;
    onUnreadFirstChange: (value: boolean) => void;
};

const SORT_LABEL_KEYS: Record<string, string> = {
    recent: "recentlyActive",
    oldest_activity: "oldestActivity",
    top_spenders: "topSpenders",
    least_spent: "leastSpent",
    newest_fans: "newestFans",
    oldest_fans: "oldestFans",
};

export function SortMenu({ sortBy, onSortChange, unreadFirst, onUnreadFirstChange }: Props) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const currentLabel = t(SORT_LABEL_KEYS[sortBy] as any) || t("recentlyActive");

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={`p-2 rounded-xl transition-colors border ${open ? "bg-teal-500/10 border-teal-500/30 text-teal-400" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"}`}
                title={`${t("sortBy")}: ${currentLabel}`}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5h10" /><path d="M11 9h7" /><path d="M11 13h4" />
                    <path d="M3 17l3 3 3-3" /><path d="M6 18V4" />
                </svg>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 z-40 glass-panel rounded-2xl border border-white/10 p-4 shadow-2xl bg-gray-900/95 backdrop-blur-xl">
                        {/* Unread First Toggle */}
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                            <span className="text-sm text-white/80">{t("showUnreadFirst")}</span>
                            <button
                                onClick={() => onUnreadFirstChange(!unreadFirst)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${unreadFirst ? "bg-purple-500" : "bg-white/20"}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${unreadFirst ? "translate-x-5" : "translate-x-0.5"}`} />
                            </button>
                        </div>

                        {/* Sort Options */}
                        <div className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{t("sortBy")}</div>
                        <div className="space-y-1">
                            {SORT_VALUES.map(val => (
                                <button
                                    key={val}
                                    onClick={() => { onSortChange(val); setOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${sortBy === val ? "bg-purple-500/20 text-purple-300 font-semibold" : "text-white/70 hover:bg-white/5"}`}
                                >
                                    {t(SORT_LABEL_KEYS[val] as any)}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

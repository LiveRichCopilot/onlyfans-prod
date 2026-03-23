"use client";

import { useLanguage } from "@/lib/LanguageContext";

type Tab = "quick" | "shift" | "week";

type Props = {
    active: Tab;
    onSelect: (tab: Tab) => void;
};

export function RangeTabs({ active, onSelect }: Props) {
    const { t } = useLanguage();
    const tabs: { key: Tab; label: string }[] = [
        { key: "quick", label: t("quickPresets") },
        { key: "shift", label: t("shiftPresets") },
        { key: "week", label: t("weekPicker") },
    ];
    return (
        <div className="flex border-b border-white/10">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onSelect(tab.key)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                        active === tab.key
                            ? "text-teal-400 border-b-2 border-teal-400"
                            : "text-white/40 hover:text-white/60"
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

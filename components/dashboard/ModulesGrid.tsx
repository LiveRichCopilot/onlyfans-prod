"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { ModuleCard } from "./ModuleCard";

export function ModulesGrid() {
    const { t } = useLanguage();
    const modules = [
        { code: "NOT-01", title: t("whaleAlert"), description: t("whaleAlertDesc"), buttonLabel: t("configure"), active: true },
        { code: "STF-01", title: t("chatterMonitor"), description: t("chatterMonitorDesc"), buttonLabel: t("configure"), active: true },
        { code: "INT-03", title: t("aiChatAssist"), description: t("aiChatAssistDesc"), buttonLabel: t("enableApi"), active: false },
    ];
    return (
        <div>
            <h2 className="text-lg font-semibold text-white/80 mb-4 px-2">{t("globalModules")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modules.map((m) => (
                    <ModuleCard key={m.code} {...m} />
                ))}
            </div>
        </div>
    );
}

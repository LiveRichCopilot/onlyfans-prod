"use client";

import { useLanguage } from "@/lib/LanguageContext";

export function MessageLoader() {
    const { t } = useLanguage();
    return (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <div className="animate-spin w-7 h-7 rounded-full border-2 border-white/20 border-t-[#0D9488] mb-3" />
            <span className="text-sm text-white/50">{t("loadingMessages")}</span>
        </div>
    );
}

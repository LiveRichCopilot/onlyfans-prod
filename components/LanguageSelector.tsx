"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const LANGUAGES = [
  { value: "en" as const, labelKey: "langEnglish" as const },
  { value: "es" as const, labelKey: "langSpanish" as const },
];

type Variant = "compact" | "default";

type Props = {
  variant?: Variant;
};

export function LanguageSelector({ variant = "default" }: Props) {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.value === locale) || LANGUAGES[0];
  const isCompact = variant === "compact";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-xl border transition-all outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 ${
          isCompact
            ? "px-2.5 py-1.5 bg-white/5 border-white/10 hover:bg-white/8 text-sm"
            : "px-3 py-2.5 glass-button border-white/10 hover:border-white/15 text-sm font-medium"
        }`}
        aria-label="Select language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe size={isCompact ? 14 : 16} className="text-white/60 shrink-0" />
        <span className="text-white/90 truncate max-w-[6rem]">
          {isCompact ? current.value.toUpperCase() : t(current.labelKey)}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" />
          <div
            role="listbox"
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] py-1 glass-panel rounded-xl border border-white/10 shadow-xl overflow-hidden"
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                role="option"
                aria-selected={locale === lang.value}
                onClick={() => {
                  setLocale(lang.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors ${
                  locale === lang.value
                    ? "bg-teal-500/15 text-teal-400"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{t(lang.labelKey)}</span>
                {locale === lang.value && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

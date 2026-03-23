"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { translations, type Locale, type TranslationKey } from "./i18n";

type ContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<ContextValue | null>(null);

const STORAGE_KEY = "of-hq-locale";

function interpolate(str: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v)),
    str
  );
}

/** Fallback when used outside LanguageProvider (e.g. during SSR or layout edge cases) */
function fallbackT(key: TranslationKey, vars?: Record<string, string | number>) {
  const str = translations.en[key as keyof typeof translations.en] ?? String(key);
  return vars ? interpolate(str, vars) : str;
}

const FALLBACK_VALUE: ContextValue = {
  locale: "en",
  setLocale: () => {},
  t: fallbackT,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "en" || stored === "es") setLocaleState(stored);
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== "undefined") document.documentElement.lang = locale;
  }, [mounted, locale]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const str = translations[locale][key] ?? translations.en[key] ?? key;
      return vars ? interpolate(str, vars) : str;
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  return ctx ?? FALLBACK_VALUE;
}

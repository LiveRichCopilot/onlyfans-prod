"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <Globe size={16} className="text-white/60 ml-3" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as "en" | "es")}
        className="bg-transparent text-white text-sm font-medium py-2 pr-4 pl-1 outline-none cursor-pointer appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
        }}
      >
        <option value="en" className="bg-[#111] text-white">EN</option>
        <option value="es" className="bg-[#111] text-white">ES</option>
      </select>
    </div>
  );
}

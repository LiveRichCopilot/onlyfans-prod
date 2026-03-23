"use client";

import { LayoutGrid, MessageSquare, BarChart2, Image as ImageIcon, ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

const PRIMARY_KEYS = [
  { href: "/", icon: LayoutGrid, labelKey: "home" as const },
  { href: "/inbox", icon: MessageSquare, labelKey: "inbox" as const },
  { href: "/content-daily", icon: ImageIcon, labelKey: "content" as const },
  { href: "/team-analytics", icon: BarChart2, labelKey: "analytics" as const },
] as const;

const MORE_KEYS = [
  { href: "/content-feed", labelKey: "contentFeed" as const },
  { href: "/reports", labelKey: "reports" as const },
  { href: "/schedule", labelKey: "schedule" as const },
  { href: "/performance", labelKey: "performance" as const },
  { href: "/chatter", labelKey: "chatter" as const },
  { href: "/cfo", labelKey: "cfo" as const },
] as const;

export function MobileBottomNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 left-3 right-3 glass-card rounded-2xl border border-white/10 p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {MORE_KEYS.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition ${pathname === item.href ? "text-teal-400 bg-teal-500/10" : "text-white/70 hover:bg-white/5"}`}>
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-panel border-t border-white/10 backdrop-blur-xl safe-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {PRIMARY_KEYS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition ${active ? "text-teal-400" : "text-white/40"}`}>
                <Icon size={20} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
          <button onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition ${showMore ? "text-teal-400" : "text-white/40"}`}>
            <ChevronUp size={20} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />
            <span className="text-[10px] font-medium">{t("more")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

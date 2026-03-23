"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid, MessageSquare, Activity, Users, Database, Zap, BarChart2, Link2, Calendar, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/team") return pathname === "/team";
  return pathname === href || pathname.startsWith(href + "/");
}

type Creator = {
    id: string;
    name?: string;
    ofUsername?: string;
    avatarUrl?: string;
    headerUrl?: string;
    active?: boolean;
};

type Props = {
    creators: Creator[];
    loading: boolean;
    onAddAccount: () => void;
};

export function Sidebar({ creators, loading, onAddAccount }: Props) {
    const { t } = useLanguage();
    const pathname = usePathname() ?? "";

    const navLink = (href: string, children: React.ReactNode) => {
        const active = isNavActive(pathname, href);
        return (
            <li className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition cursor-pointer ${
                active ? "bg-white/10 text-white border border-white/10" : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
            }`}>
                {children}
            </li>
        );
    };
    return (
        <aside className="w-72 h-[calc(100vh-2rem)] my-4 ml-4 glass-panel rounded-3xl p-6 flex flex-col border-gray-800 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-6">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-600 to-gray-700 flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-900/50 shrink-0">
                        OF
                    </div>
                    <div className="min-w-0">
                        <div className="text-xl font-bold tracking-tight text-white/90 truncate">HQ</div>
                        <div className="text-xs text-white/50 truncate">{t("agencyWorkspace")}</div>
                    </div>
                </div>
                <LanguageSelector variant="compact" />
            </div>

            <nav className="space-y-8 flex-1">
                <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2">{t("creators")}</div>
                    <ul className="space-y-2">
                        {creators.map((c) => (
                            <li key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 transition cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        {c.avatarUrl ? (
                                            <img src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`} alt={c.name || ""} className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/20">
                                                {c.name ? c.name.charAt(0).toUpperCase() : "?"}
                                            </div>
                                        )}
                                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${c.active ? "bg-teal-500" : "bg-gray-500"}`} />
                                    </div>
                                    <span className="text-sm font-medium text-white/80 group-hover:text-white truncate max-w-[120px]">{c.name || t("unknownProfile")}</span>
                                </div>
                            </li>
                        ))}
                        {creators.length === 0 && !loading && (
                            <li className="px-3 py-2 text-xs text-white/40 italic">{t("noAccountsLinked")}</li>
                        )}
                        <li className="mt-2 text-center">
                            <button onClick={onAddAccount} className="text-xs text-teal-400 font-medium hover:text-teal-300 transition">
                                {t("addAccount")}
                            </button>
                        </li>
                    </ul>
                </div>

                <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2">{t("management")}</div>
                    <ul className="space-y-1">
                        <Link href="/">{navLink("/", <><LayoutGrid size={16} /> {t("dashboard")}</>)}</Link>
                        <Link href="/inbox">{navLink("/inbox", <><MessageSquare size={16} /> {t("liveInbox")}<span className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded ml-auto border border-purple-500/30 font-bold tracking-wider">{t("new")}</span></>)}</Link>
                        <li className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 cursor-pointer"><Activity size={16} /> {t("realtimeFeed")}</li>
                        <Link href="/team">{navLink("/team", <><Users size={16} /> {t("teamManagement")}</>)}</Link>
                        <Link href="/team-analytics">{navLink("/team-analytics", <><BarChart2 size={16} /> {t("teamAnalytics")}<span className="bg-teal-500/20 text-teal-400 text-[10px] px-1.5 py-0.5 rounded ml-auto border border-teal-500/30 font-bold tracking-wider">{t("new")}</span></>)}</Link>
                        <Link href="/schedule">{navLink("/schedule", <><Calendar size={16} /> {t("shiftSchedule")}<span className="bg-[#5B9BD5]/20 text-[#5B9BD5] text-[10px] px-1.5 py-0.5 rounded ml-auto border border-[#5B9BD5]/30 font-bold tracking-wider">{t("new")}</span></>)}</Link>
                        <Link href="/content-daily">{navLink("/content-daily", <><ImageIcon size={16} /> {t("contentDaily")}<span className="bg-teal-500/20 text-teal-400 text-[10px] px-1.5 py-0.5 rounded ml-auto border border-teal-500/30 font-bold tracking-wider">{t("new")}</span></>)}</Link>
                        <Link href="/content-feed">{navLink("/content-feed", <><BarChart2 size={16} /> {t("contentFeed")}</>)}</Link>
                        <Link href="/performance">{navLink("/performance", <><Zap size={16} /> {t("performance")}</>)}</Link>
                        <Link href="/team/hubstaff">{navLink("/team/hubstaff", <><Link2 size={16} /> {t("hubstaff")}</>)}</Link>
                        <Link href="/system">{navLink("/system", <><Database size={16} /> {t("systemIntelligence")}</>)}</Link>
                    </ul>
                </div>
            </nav>
        </aside>
    );
}

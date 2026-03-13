"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Eye, Send, Image as ImageIcon, MessageSquare, BarChart3,
  Zap, TrendingUp, Calendar, ChevronDown,
  AlertTriangle, Filter, Trophy,
} from "lucide-react";
import ContentCard, { KpiCard, fN, type ContentItem } from "./ContentCard";
import HourlyBreakdown from "./HourlyBreakdown";
import ChatterDmScoreboard from "./ChatterDmScoreboard";

type DailyRow = { date: string; massMessages: number; dms: number; wallPosts: number; withMedia: number; bumps: number; totalSent: number; totalViewed: number; free: number; paid: number };
type TacticRow = { tag: string; count: number; avgScore: number };
type KPIs = { totalMessages: number; totalWithMedia: number; totalSent: number; totalViewed: number; avgViewRate: number; insightsCount: number };
type HourSlot = { hour: number; count: number; sources: Record<string, number>; creators: string[] };
type HourlyDay = { date: string; hours: HourSlot[] };
type SilentModel = { id: string; name: string; ofUsername: string | null; lastContentAt: string | null; daysSilent: number | null };
type LeaderRow = { name: string; ofUsername: string; massMessages: number; withMedia: number; bumps: number; totalSent: number; totalViewed: number; purchased: number };
type BumpItem = { id: string; creator: { name: string; ofUsername: string }; sentAtUk: string; caption: string; sentCount: number; viewedCount: number; viewRate: number; source: string; chatterName: string | null };
type ChatterDmRow = { chatter: string; sent: number; sold: number; unsold: number; pending: number; revenue: number; creators: string[] };

export default function ContentDailyPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [tactics, setTactics] = useState<TacticRow[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [silentModels, setSilentModels] = useState<SilentModel[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [bumps, setBumps] = useState<BumpItem[]>([]);
  const [hourly, setHourly] = useState<HourlyDay[]>([]);
  const [chatterDmStats, setChatterDmStats] = useState<ChatterDmRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("mass_message");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(new Set<string>());

  useEffect(() => {
    setLoading(true);
    const sourceParam = sourceFilter !== "all" ? `&source=${sourceFilter}` : "";
    fetch(`/api/team-analytics/content-daily?days=${days}${sourceParam}`)
      .then((r) => r.json())
      .then((data) => {
        // Client-side validation: only accept items that have real media
        const validItems = (data.items || []).filter((i: ContentItem) =>
          i.mediaCount > 0 && i.media && i.media.length > 0 &&
          i.media.some((m: any) => m.permanentUrl || m.previewUrl || m.thumbUrl || m.fullUrl)
        );
        setItems(validItems);
        setDaily(data.daily || []);
        setTactics(data.tactics || []);
        setKpis(data.kpis || null);
        setSilentModels(data.silentModels || []);
        setLeaderboard(data.leaderboard || []);
        setBumps(data.bumps || []);
        setHourly(data.hourly || []);
        setChatterDmStats(data.chatterDmStats || []);
        setTotalCount(data.totalCount || 0);
        // Auto-expand today
        if (data.daily?.[0]) setExpanded(new Set([data.daily[0].date, "silent", "leaderboard", "chatter-dm"]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days, sourceFilter]);

  const creatorNames = useMemo(() => {
    const names = new Map<string, string>();
    items.forEach((i) => names.set(i.creator.ofUsername || i.creator.name, i.creator.name));
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    let f = items;
    if (creatorFilter !== "all") f = f.filter((i) => (i.creator.ofUsername || i.creator.name) === creatorFilter);
    if (statusFilter === "ppv") f = f.filter((i) => !i.isFree && i.priceCents && i.priceCents > 0);
    else if (statusFilter === "free") f = f.filter((i) => i.isFree || !i.priceCents);
    else if (statusFilter === "sold") f = f.filter((i) => i.status === "selling");
    else if (statusFilter === "didnt_sell") f = f.filter((i) => i.status === "stagnant");
    return f;
  }, [items, creatorFilter, statusFilter]);

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    filtered.forEach((i) => {
      const d = i.sentAtUk.split(",")[0]; // "04/03/2026"
      const arr = map.get(d) || [];
      arr.push(i);
      map.set(d, arr);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const toggle = (key: string) => {
    setExpanded((prev: Set<string>) => {
      const next = new Set<string>(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#050508] overflow-y-auto">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>
      <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 size={22} className="text-teal-400" /> Content Daily
            </h1>
            <p className="text-white/50 text-sm">Mass messages, DMs, wall posts — all outbound content with media</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="glass-panel rounded-xl p-1 flex items-center gap-1">
              <MessageSquare size={12} className="text-white/40 ml-2" />
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none px-1 py-1.5 cursor-pointer">
                <option value="all" className="bg-[#111]">All Content</option>
                <option value="mass_message" className="bg-[#111]">Mass Messages</option>
                <option value="direct_message" className="bg-[#111]">DMs</option>
                <option value="wall_post" className="bg-[#111]">Wall Posts</option>
              </select>
            </div>
            <div className="glass-panel rounded-xl p-1 flex items-center gap-1">
              <Filter size={12} className="text-white/40 ml-2" />
              <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)}
                className="bg-transparent text-xs text-white border-none outline-none px-1 py-1.5 cursor-pointer">
                <option value="all" className="bg-[#111]">All Models</option>
                {creatorNames.map(([key, name]) => (
                  <option key={key} value={key} className="bg-[#111]">{name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1 glass-panel rounded-xl p-1">
              {[1, 3, 7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${days === d ? "bg-teal-500/20 text-teal-400" : "text-white/50 hover:text-white/80"}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            ["all", "All"],
            ["ppv", "PPV Only"],
            ["free", "Free Only"],
            ["sold", "Sold"],
            ["didnt_sell", "Didn't Sell"],
          ] as [string, string][]).map(([key, label]) => {
            const counts: Record<string, number> = {
              all: items.length,
              ppv: items.filter((i) => !i.isFree && i.priceCents && i.priceCents > 0).length,
              free: items.filter((i) => i.isFree || !i.priceCents).length,
              sold: items.filter((i) => i.status === "selling").length,
              didnt_sell: items.filter((i) => i.status === "stagnant").length,
            };
            return (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === key
                  ? key === "sold" ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                  : key === "didnt_sell" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                  : "bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30"
                  : "glass-panel text-white/60 hover:text-white/80"}`}>
                {label} <span className="text-xs opacity-70">({counts[key]})</span>
              </button>
            );
          })}
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard icon={<MessageSquare size={14} />} label="Messages" value={kpis.totalMessages} />
            <KpiCard icon={<ImageIcon size={14} />} label="With Media" value={kpis.totalWithMedia} />
            <KpiCard icon={<Send size={14} />} label="Total Sent" value={fN(kpis.totalSent)} />
            <KpiCard icon={<Eye size={14} />} label="Total Viewed" value={fN(kpis.totalViewed)} />
            <KpiCard icon={<TrendingUp size={14} />} label="Avg View Rate" value={`${kpis.avgViewRate}%`} accent />
            <KpiCard icon={<Zap size={14} />} label="AI Insights" value={kpis.insightsCount} />
          </div>
        )}

        {/* Capped indicator */}
        {totalCount > items.length && (
          <div className="glass-inset rounded-xl p-3 mb-6 flex items-center justify-between">
            <span className="text-sm text-white/60">Showing {items.length} of {totalCount.toLocaleString()} total — filter by model or source to see more</span>
          </div>
        )}

        {/* Silent Models — collapsible */}
        {silentModels.length > 0 && (
          <div className="glass-card rounded-2xl mb-6 border border-red-500/20 overflow-hidden">
            <button onClick={() => toggle("silent")} className="w-full flex items-center justify-between p-4 text-left">
              <span className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} /> No Content Sent — {silentModels.length} models silent
              </span>
              <ChevronDown size={16} className={`text-white/50 transition-transform ${expanded.has("silent") ? "rotate-180" : ""}`} />
            </button>
            {expanded.has("silent") && (
              <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {silentModels.map((m) => (
                  <div key={m.id} className="glass-inset rounded-lg p-3">
                    <div className="text-sm text-white font-medium">{m.name}</div>
                    {m.ofUsername && <div className="text-xs text-white/50">@{m.ofUsername}</div>}
                    <div className="text-xs text-red-400 mt-1">
                      {m.lastContentAt ? (() => {
                        const hoursAgo = Math.round((Date.now() - new Date(m.lastContentAt).getTime()) / 3600000);
                        const timeAgo = hoursAgo < 1 ? "just now" : hoursAgo < 24 ? `${hoursAgo}h ago` : `${m.daysSilent}d ago`;
                        return `Last sent: ${timeAgo}`;
                      })() : "Never sent content"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Model Leaderboard — collapsible */}
        {leaderboard.length > 0 && (
          <div className="glass-card rounded-2xl mb-6 overflow-hidden">
            <button onClick={() => toggle("leaderboard")} className="w-full flex items-center justify-between p-4 text-left">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Trophy size={14} className="text-yellow-400" /> Model Leaderboard — Who's sending the most
              </span>
              <ChevronDown size={16} className={`text-white/50 transition-transform ${expanded.has("leaderboard") ? "rotate-180" : ""}`} />
            </button>
            {expanded.has("leaderboard") && <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/50 border-b border-white/5">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Model</th>
                    <th className="text-right py-2 px-2">Mass Msgs</th>
                    <th className="text-right py-2 px-2">With Media</th>
                    <th className="text-right py-2 px-2">Bumps</th>
                    <th className="text-right py-2 px-2">Sent To</th>
                    <th className="text-right py-2 px-2">Viewed</th>
                    <th className="text-right py-2 px-2">Bought</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((m, i) => (
                    <tr key={m.ofUsername || m.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 pr-4 text-white/40">{i + 1}</td>
                      <td className="py-2 pr-4 text-teal-400 font-medium">{m.name}</td>
                      <td className="py-2 px-2 text-right text-white font-semibold">{m.massMessages}</td>
                      <td className="py-2 px-2 text-right text-white/80">{m.withMedia}</td>
                      <td className="py-2 px-2 text-right text-white/50">{m.bumps}</td>
                      <td className="py-2 px-2 text-right text-white/80">{fN(m.totalSent)}</td>
                      <td className="py-2 px-2 text-right text-white/80">{fN(m.totalViewed)}</td>
                      <td className="py-2 px-2 text-right text-emerald-400 font-medium">{m.purchased}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        )}

        {/* Chatter DM Sales Scoreboard */}
        <ChatterDmScoreboard stats={chatterDmStats} expanded={expanded} onToggle={toggle} />

        {/* Hour-by-Hour Breakdown */}
        <HourlyBreakdown hourly={hourly} expanded={expanded} onToggle={toggle} />

        {/* Bumps — text-only messages, collapsible */}
        {bumps.length > 0 && (
          <div className="glass-card rounded-2xl mb-6 overflow-hidden">
            <button onClick={() => toggle("bumps")} className="w-full flex items-center justify-between p-4 text-left">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare size={14} className="text-purple-400" /> Bumps (Text Only) — {bumps.length} messages
              </span>
              <ChevronDown size={16} className={`text-white/50 transition-transform ${expanded.has("bumps") ? "rotate-180" : ""}`} />
            </button>
            {expanded.has("bumps") && (
              <div className="px-4 pb-4 space-y-1">
                {bumps.map((b) => {
                  const timeParts = b.sentAtUk.split(", ");
                  const time = (timeParts[1] || "").slice(0, 5);
                  return (
                    <div key={b.id} className="glass-inset rounded-lg px-3 py-2 flex items-center gap-3">
                      <span className="text-xs text-white/40 w-12 shrink-0">{time}</span>
                      <span className="text-xs text-teal-400 font-medium w-24 shrink-0 truncate">{b.creator.name}</span>
                      <p className="text-xs text-white/70 flex-1 truncate">{b.caption || "(no text)"}</p>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="text-white/50 flex items-center gap-1"><Send size={11} /> {fN(b.sentCount)}</span>
                        <span className="text-white/50 flex items-center gap-1"><Eye size={11} /> {fN(b.viewedCount)}</span>
                        <span className={`font-semibold ${b.viewRate > 1 ? "text-teal-400" : b.viewRate > 0.3 ? "text-yellow-400" : "text-red-400"}`}>{b.viewRate}%</span>
                      </div>
                      {b.chatterName && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full shrink-0">{b.chatterName}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content by Day — collapsible */}
        {loading ? (
          <div className="text-center text-white/50 py-20">Loading content...</div>
        ) : byDate.length === 0 ? (
          <div className="text-center text-white/50 py-20">No content found</div>
        ) : (
          <div className="space-y-4">
            {byDate.map(([dateStr, dayItems]) => {
              const isOpen = expanded.has(dateStr);
              const selling = dayItems.filter((i) => i.status === "selling").length;
              const stagnant = dayItems.filter((i) => i.status === "stagnant").length;
              const freeCount = dayItems.filter((i) => i.status === "free").length;
              const massCount = dayItems.filter((i) => i.source === "mass_message").length;
              const dmCount = dayItems.filter((i) => i.source === "direct_message").length;
              const wallCount = dayItems.filter((i) => i.source === "wall_post").length;
              return (
                <div key={dateStr} className="glass-card rounded-2xl overflow-hidden">
                  <button onClick={() => toggle(dateStr)}
                    className="w-full flex items-center justify-between p-4 text-left">
                    <div className="flex items-center gap-3">
                      <Calendar size={16} className="text-teal-400" />
                      <span className="text-base text-white font-semibold">{dateStr}</span>
                      <span className="text-sm text-white/50">{dayItems.length} total</span>
                      {massCount > 0 && <span className="text-xs text-white/60">{massCount} mass</span>}
                      {dmCount > 0 && <span className="text-xs text-purple-400">{dmCount} DMs</span>}
                      {wallCount > 0 && <span className="text-xs text-blue-400">{wallCount} wall</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {selling > 0 && <span className="text-xs text-emerald-400">{selling} sold</span>}
                      {stagnant > 0 && <span className="text-xs text-red-400">{stagnant} didn't sell</span>}
                      {freeCount > 0 && <span className="text-xs text-white/40">{freeCount} free</span>}
                      <ChevronDown size={16} className={`text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {dayItems.map((item) => <ContentCard key={item.id} item={item} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


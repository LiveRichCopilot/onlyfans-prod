"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Eye, Send, Image as ImageIcon, MessageSquare, BarChart3,
  Zap, TrendingUp, Calendar, ChevronDown, Clock, DollarSign,
  AlertTriangle, CheckCircle, XCircle, Filter, Trophy, Users,
} from "lucide-react";

type MediaItem = { mediaType: string; fullUrl: string | null; previewUrl: string | null; thumbUrl: string | null; permanentUrl: string | null };
type InsightData = { tacticTag: string; hookScore: number; insight: string; viewRate: number } | null;
type ContentItem = {
  id: string; externalId: string;
  creator: { name: string; ofUsername: string };
  sentAt: string; sentAtUk: string; hoursLive: number; caption: string;
  isFree: boolean; priceCents: number | null; mediaCount: number;
  sentCount: number; viewedCount: number; viewRate: number;
  purchasedCount: number | null;
  dormantBefore: number | null;
  wakeUp1h: number | null; wakeUp3h: number | null; wakeUp6h: number | null; wakeUp24h: number | null;
  isCanceled: boolean; status: "selling" | "stagnant" | "awaiting" | "free" | "unsent";
  source: string; type: "content" | "bump"; media: MediaItem[]; insight: InsightData;
};
type DailyRow = { date: string; massMessages: number; dms: number; wallPosts: number; withMedia: number; bumps: number; totalSent: number; totalViewed: number; free: number; paid: number };
type TacticRow = { tag: string; count: number; avgScore: number };
type KPIs = { totalMessages: number; totalWithMedia: number; totalSent: number; totalViewed: number; avgViewRate: number; insightsCount: number };
type SilentModel = { id: string; name: string; ofUsername: string | null; lastContentAt: string | null; daysSilent: number | null };
type LeaderRow = { name: string; ofUsername: string; massMessages: number; withMedia: number; bumps: number; totalSent: number; totalViewed: number; purchased: number };

export default function ContentDailyPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [tactics, setTactics] = useState<TacticRow[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [silentModels, setSilentModels] = useState<SilentModel[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(new Set<string>());

  useEffect(() => {
    setLoading(true);
    const sourceParam = sourceFilter !== "all" ? `&source=${sourceFilter}` : "";
    fetch(`/api/team-analytics/content-daily?days=${days}${sourceParam}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setDaily(data.daily || []);
        setTactics(data.tactics || []);
        setKpis(data.kpis || null);
        setSilentModels(data.silentModels || []);
        setLeaderboard(data.leaderboard || []);
        // Auto-expand today
        if (data.daily?.[0]) setExpanded(new Set([data.daily[0].date, "silent", "leaderboard"]));
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
    return f;
  }, [items, creatorFilter]);

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
                      {m.lastContentAt ? `Last: ${new Date(m.lastContentAt).toLocaleDateString("en-GB", { timeZone: "Europe/London" })} (${m.daysSilent}d ago)` : "Never sent content"}
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

function ContentCard({ item }: { item: ContentItem }) {
  const permanentUrl = item.media[0]?.permanentUrl;
  const cdnUrl = item.media[0]?.previewUrl || item.media[0]?.thumbUrl || item.media[0]?.fullUrl;
  const imgSrc = permanentUrl
    ? permanentUrl
    : cdnUrl
      ? `/api/proxy-media?url=${encodeURIComponent(cdnUrl)}`
      : null;
  const isPaid = !item.isFree && item.priceCents && item.priceCents > 0;
  const mediaSummary = useMemo(() => {
    const c: Record<string, number> = {};
    item.media.forEach((m) => { c[m.mediaType] = (c[m.mediaType] || 0) + 1; });
    return Object.entries(c).map(([t, n]) => `${n} ${t}${n > 1 ? "s" : ""}`).join(", ");
  }, [item.media]);

  // Extract just the time from sentAtUk (e.g. "04/03/2026, 14:10:47" → "14:10")
  const timeParts = item.sentAtUk.split(", ");
  const dateOnly = timeParts[0] || "";
  const timeOnly = (timeParts[1] || "").slice(0, 5);

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${item.status === "stagnant" ? "border border-red-500/20" : ""}`}>
      {imgSrc ? (
        <div className="relative aspect-[4/3] bg-black/40">
          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
          {/* Big time overlay top-left */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-3">
            <div className="text-xl text-white font-bold">{timeOnly} UK</div>
            <div className="text-sm text-white/80">{dateOnly}</div>
          </div>
          {/* Hours live — big bottom-left */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-end justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-white" />
              <span className="text-lg text-white font-bold">{item.hoursLive}h live</span>
            </div>
            <div className="flex items-center gap-2">
              {isPaid && <span className="bg-teal-500/90 text-white text-sm px-3 py-1 rounded-full font-bold flex items-center gap-1"><DollarSign size={13} />${(item.priceCents! / 100).toFixed(0)} PPV</span>}
              {item.media.length > 1 && <span className="bg-black/60 text-white text-sm px-2 py-1 rounded-full font-medium">+{item.media.length - 1}</span>}
            </div>
          </div>
          {item.isCanceled && <span className="absolute top-3 right-3 bg-red-500/90 text-white text-sm px-3 py-1 rounded-full font-bold">Unsent</span>}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-white/[0.02] flex items-center justify-center"><ImageIcon size={32} className="text-white/20" /></div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-teal-400 font-semibold">{item.creator.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.source === "direct_message" ? "bg-purple-500/20 text-purple-400" : item.source === "wall_post" ? "bg-blue-500/20 text-blue-400" : "bg-white/[0.08] text-white/50"}`}>
              {item.source === "direct_message" ? "DM" : item.source === "wall_post" ? "Wall Post" : "Mass Msg"}
            </span>
          </div>
          {item.status === "selling" && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">Sold</span>}
          {item.status === "stagnant" && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">Didn't Sell</span>}
          {item.status === "awaiting" && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium">PPV</span>}
          {item.status === "free" && <span className="text-xs bg-white/[0.06] text-white/50 px-2 py-0.5 rounded-full">Free</span>}
          {item.status === "unsent" && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Unsent</span>}
        </div>
        <p className="text-sm text-white/80 mb-3 line-clamp-3">{item.caption || "(no caption)"}</p>
        <div className="flex items-center gap-4 text-sm text-white/80 mb-2">
          <span className="flex items-center gap-1"><Send size={13} /> {fN(item.sentCount)}</span>
          <span className="flex items-center gap-1"><Eye size={13} /> {fN(item.viewedCount)}</span>
          {item.purchasedCount != null && item.purchasedCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400"><DollarSign size={13} /> {item.purchasedCount} bought</span>
          )}
          {item.purchasedCount === 0 && isPaid && (
            <span className="flex items-center gap-1 text-red-400"><XCircle size={13} /> 0 bought</span>
          )}
          <span className={`ml-auto text-base font-bold ${item.viewRate > 1 ? "text-teal-400" : item.viewRate > 0.3 ? "text-yellow-400" : "text-red-400"}`}>{item.viewRate}%</span>
        </div>
        {/* Wake Up Rate */}
        {item.dormantBefore != null && item.dormantBefore > 0 && (
          <div className="mt-2 glass-inset rounded-lg p-2">
            <div className="text-xs text-white/70 mb-1 font-medium">Cold Fans Woke Up — {item.dormantBefore} replied</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {([["1h", item.wakeUp1h], ["3h", item.wakeUp3h], ["6h", item.wakeUp6h], ["24h", item.wakeUp24h]] as [string, number | null][]).map(([label, val]) => {
                const v = val ?? 0;
                return (
                  <div key={label} className="text-center">
                    <div className={`text-sm font-bold ${v > 0 ? "text-teal-400" : "text-white/30"}`}>{v}</div>
                    <div className="text-white/50">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {mediaSummary && <div className="text-xs text-white/50 mt-1">{mediaSummary}</div>}
        {item.insight && (
          <div className="mt-2 glass-inset rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded-full">{item.insight.tacticTag.replace(/_/g, " ")}</span>
              <span className="text-xs text-white/50">Score: {item.insight.hookScore}</span>
            </div>
            <p className="text-xs text-white/60">{item.insight.insight}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">{icon}{label}</div>
      <div className={`text-lg font-semibold ${accent ? "text-teal-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

function fN(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

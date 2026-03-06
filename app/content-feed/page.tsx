"use client";

import { useEffect, useState, useMemo } from "react";
import { Eye, Send, Image as ImageIcon, MessageSquare, Play, DollarSign, Users, Info } from "lucide-react";

type MediaItem = { mediaType: string; fullUrl: string | null; previewUrl: string | null; thumbUrl: string | null; permanentUrl: string | null };
type WakeUp = { dormantBefore: number; w30m: number; w1h: number; w3h: number; w6h: number; w24h: number; chatterDMs1h: number; chatterDMs3h: number };
type CreatorOption = { id: string; name: string };
type ContentItem = {
  id: string;
  externalId: string;
  creatorId: string;
  creator: { name: string; ofUsername: string };
  sentAt: string;
  sentAtUk: string;
  sentDate: string;
  caption: string;
  isFree: boolean;
  priceCents: number;
  purchasedCount: number;
  revenue: number;
  mediaCount: number;
  sentCount: number;
  viewedCount: number;
  viewRate: number;
  isCanceled: boolean;
  type: "content" | "bump";
  media: MediaItem[];
  wakeUp: WakeUp | null;
};
type Summary = { total: number; withMedia: number; bumps: number; totalViews: number; totalSent: number; avgViewRate: string };

export default function ContentFeedPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "content" | "bump">("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [days, setDays] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/team-analytics/content-feed?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setSummary(data.summary || null);
        setCreators(data.creators || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== "all") result = result.filter((i) => i.type === filter);
    if (creatorFilter !== "all") result = result.filter((i) => i.creatorId === creatorFilter);
    return result;
  }, [items, filter, creatorFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const item of filtered) {
      const date = item.sentDate;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#050508] overflow-y-auto">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Content Feed</h1>
        <p className="text-white/50 text-sm mb-6">Mass messages, PPVs, and bump messages across all creators</p>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<ImageIcon size={16} />} label="With Media" value={summary.withMedia} />
            <StatCard icon={<MessageSquare size={16} />} label="Bump Messages" value={summary.bumps} />
            <StatCard icon={<Send size={16} />} label="Total Sent" value={formatNum(summary.totalSent)} />
            <StatCard icon={<Eye size={16} />} label="Avg View Rate" value={`${summary.avgViewRate}%`} />
          </div>
        )}

        {/* Info banner */}
        <div className="glass-panel rounded-xl p-3 mb-6 flex items-start gap-2">
          <Info size={14} className="text-teal-400 mt-0.5 shrink-0" />
          <div className="text-[11px] text-white/60 leading-relaxed">
            <span className="text-white/80 font-medium">Mass Messages</span> = broadcasts sent from the creator account to many fans at once. Not 1-on-1 chatter DMs.
            <br />Revenue updates on every sync. Wake-up rate + chatter DMs update every 15 min.
          </div>
        </div>

        {/* Filters row */}
        <div className="flex gap-2 mb-6 flex-wrap items-center">
          {/* Creator picker */}
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="glass-panel rounded-xl px-3 py-1.5 text-xs font-medium bg-transparent text-white/80 border-none outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#111]">All Creators</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#111]">{c.name}</option>
            ))}
          </select>

          {/* Type filter */}
          <div className="flex gap-1 glass-panel rounded-xl p-1">
            {(["all", "content", "bump"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? "bg-teal-500/20 text-teal-400" : "text-white/50 hover:text-white/80"}`}>
                {f === "all" ? "All" : f === "content" ? "With Media" : "Bumps"}
              </button>
            ))}
          </div>

          {/* Day range */}
          <div className="flex gap-1 glass-panel rounded-xl p-1 ml-auto">
            {[1, 3, 7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${days === d ? "bg-teal-500/20 text-teal-400" : "text-white/50 hover:text-white/80"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-white/40 py-20">Loading content...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/40 py-20">No content found for this period</div>
        ) : (
          grouped.map(([date, dateItems]) => (
            <div key={date} className="mb-8">
              <h2 className="text-sm font-semibold text-white/60 mb-3 sticky top-0 bg-[#050508]/80 backdrop-blur-sm py-2 z-10">{date}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {dateItems.map((item) => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getPostAgeHours(sentAt: string): number {
  const t = new Date(sentAt).getTime();
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function ContentCard({ item }: { item: ContentItem }) {
  const firstMedia = item.media[0];
  const permanentUrl = firstMedia?.permanentUrl;
  const cdnUrl = firstMedia?.previewUrl || firstMedia?.thumbUrl || firstMedia?.fullUrl;
  const imgSrc = permanentUrl
    ? permanentUrl
    : cdnUrl
      ? `/api/proxy-media?url=${encodeURIComponent(cdnUrl)}`
      : null;
  const isVideo = firstMedia?.mediaType === "video";
  const ageHours = getPostAgeHours(item.sentAt);
  const revenuePending = !item.isFree && ageHours < 1 && item.revenue === 0;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {imgSrc ? (
        <div className="relative aspect-[4/3] bg-black/40">
          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}
          {item.media.length > 1 && (
            <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              +{item.media.length - 1}
            </span>
          )}
          {item.isCanceled && (
            <span className="absolute top-2 left-2 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded-full">Unsent</span>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-white/[0.02] flex items-center justify-center">
          <MessageSquare size={32} className="text-white/20" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-teal-400 font-medium">{item.creator.name || item.creator.ofUsername}</span>
          <span className="text-xs text-white/30">{item.sentAtUk}</span>
        </div>

        <p className="text-sm text-white/80 mb-3 line-clamp-3">{item.caption || "(no caption)"}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1"><Send size={12} /> {formatNum(item.sentCount)}</span>
          <span className="flex items-center gap-1"><Eye size={12} /> {formatNum(item.viewedCount)}</span>
          <span className={`font-medium ${item.viewRate > 1 ? "text-teal-400" : item.viewRate > 0.3 ? "text-yellow-400" : "text-red-400"}`}>
            {item.viewRate}%
          </span>
        </div>

        {/* Revenue — hero number */}
        {!item.isFree ? (
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className={`text-lg font-bold ${revenuePending ? "text-white/40 italic" : item.revenue > 0 ? "text-green-400" : "text-red-400/60"}`}>
                {revenuePending ? "Pending" : `$${item.revenue > 0 ? item.revenue.toFixed(0) : "0"}`}
              </span>
              {!revenuePending && <span className="text-[10px] text-white/30 ml-1">earned</span>}
            </div>
            <div className="text-right text-[10px] text-white/40">
              <div>${(item.priceCents / 100).toFixed(0)} PPV</div>
              <div>{item.purchasedCount > 0 ? `${item.purchasedCount} bought` : "No purchases yet"}</div>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-white/40">Free</span>
          </div>
        )}

        {/* Media type tags */}
        {item.mediaCount > 0 && (
          <div className="mt-2 flex gap-1">
            {item.media.map((m, i) => (
              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${m.mediaType === "video" ? "bg-purple-500/10 text-purple-400" : "bg-white/[0.06] text-white/40"}`}>
                {m.mediaType}
              </span>
            ))}
          </div>
        )}

        {/* Activity after mass message */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {/* Purchases = strongest wake-up signal */}
          {!item.isFree && item.purchasedCount > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={12} className="text-green-400" />
              <span className="text-xs text-green-400 font-semibold">{item.purchasedCount} purchased</span>
            </div>
          )}

          {/* Chat wake-ups */}
          {item.wakeUp && item.wakeUp.dormantBefore > 0 ? (
            <>
              <div className="flex items-center justify-between text-[10px] text-white/40 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">Fans replied</span>
                  <span>{formatNum(item.wakeUp.dormantBefore)} sent to</span>
                </div>
                {(item.wakeUp.chatterDMs1h > 0 || item.wakeUp.chatterDMs3h > 0) && (
                  <div className="flex items-center gap-1">
                    <MessageSquare size={10} className="text-blue-400" />
                    <span className="text-blue-400">{formatNum(item.wakeUp.chatterDMs1h)} DMs out</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([["30m", item.wakeUp.w30m], ["1h", item.wakeUp.w1h], ["3h", item.wakeUp.w3h], ["6h", item.wakeUp.w6h]] as [string, number][]).map(([label, count]) => (
                  <div key={label} className="text-center bg-white/[0.04] rounded-lg py-1.5">
                    <div className={`text-xs font-semibold ${count > 0 ? "text-amber-400" : "text-white/30"}`}>{count > 0 ? count : "0"}</div>
                    <div className="text-[9px] text-white/30">{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : !item.wakeUp ? (
            <div className="text-[10px] text-white/30 italic">
              {ageHours < 0.25 ? "Just posted" : "Computing replies..."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="glass-panel rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-white/40 text-xs mb-1">{icon}{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

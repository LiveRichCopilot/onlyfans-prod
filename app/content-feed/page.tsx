"use client";

import { useEffect, useState, useMemo } from "react";
import { Eye, Send, Image as ImageIcon, MessageSquare, Play, DollarSign, Users, Info, Clock } from "lucide-react";
import WakeUpBuckets from "./WakeUpBuckets";

type MediaItem = { mediaType: string; fullUrl: string | null; previewUrl: string | null; thumbUrl: string | null; permanentUrl: string | null };
type WakeUp = {
  totalReplied: number;
  buckets: Record<string, number> | null; // {"30":5,"60":12,"90":18,...}
  chatterDMs: Record<string, number> | null;
  purchaseBuckets: Record<string, number> | null; // {"60":2,"120":5,...}
};
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
  source: string;
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
  const [filter, setFilter] = useState<string>("all");
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
    if (filter === "mass") result = result.filter((i) => i.source === "mass_message" && i.mediaCount > 0);
    else if (filter === "dm") result = result.filter((i) => i.source === "direct_message");
    else if (filter === "wall") result = result.filter((i) => i.source === "wall_post");
    else if (filter === "bump") result = result.filter((i) => i.mediaCount === 0);
    if (creatorFilter !== "all") result = result.filter((i) => i.creatorId === creatorFilter);

    // Dedup DMs: same creator + same caption = same content sent to multiple fans
    // Show once with count instead of N identical cards
    const seen = new Map<string, number>();
    const deduped: ContentItem[] = [];
    for (const item of result) {
      if (item.source === "direct_message" && item.caption) {
        const key = `${item.creatorId}|${item.caption.slice(0, 80)}`;
        const existing = seen.get(key);
        if (existing !== undefined) {
          // Merge: increment sentCount on the first one
          deduped[existing].sentCount += 1;
          if (item.purchasedCount > 0) deduped[existing].purchasedCount += item.purchasedCount;
          if (item.revenue > 0) deduped[existing].revenue += item.revenue;
          continue;
        }
        seen.set(key, deduped.length);
        item.sentCount = 1; // Start counting
      }
      deduped.push(item);
    }

    // When showing "all", interleave by creator so no single creator floods the feed.
    // Round-robin: take one item from each creator, then the second from each, etc.
    if (filter === "all") {
      const byCreator = new Map<string, ContentItem[]>();
      for (const item of deduped) {
        if (!byCreator.has(item.creatorId)) byCreator.set(item.creatorId, []);
        byCreator.get(item.creatorId)!.push(item);
      }
      const queues = Array.from(byCreator.values());
      const interleaved: ContentItem[] = [];
      let round = 0;
      let added = true;
      while (added) {
        added = false;
        for (const queue of queues) {
          if (round < queue.length) {
            interleaved.push(queue[round]);
            added = true;
          }
        }
        round++;
      }
      return interleaved;
    }

    return deduped;
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
            {(["all", "mass", "dm", "wall", "bump"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? "bg-teal-500/20 text-teal-400" : "text-white/50 hover:text-white/80"}`}>
                {f === "all" ? "All" : f === "mass" ? "Mass Msgs" : f === "dm" ? "DMs" : f === "wall" ? "Wall Posts" : "Bumps"}
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

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m live`;
  if (hours < 24) return `${Math.round(hours)}h live`;
  const days = Math.floor(hours / 24);
  return `${days}d live`;
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
          {/* Live meter — how long this has been live */}
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <Clock size={11} className="text-teal-400" />
            <span className="font-medium">{formatAge(ageHours)}</span>
          </div>
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
          )}
          {item.media.length > 1 && (
            <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
              +{item.media.length - 1}
            </span>
          )}
          {item.isCanceled && (
            <span className="absolute bottom-2 left-2 bg-red-500/80 text-white text-xs px-2 py-0.5 rounded-full">Unsent</span>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-white/[0.02] flex items-center justify-center relative">
          <MessageSquare size={32} className="text-white/20" />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <Clock size={11} className="text-teal-400" />
            <span className="font-medium">{formatAge(ageHours)}</span>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-teal-400 font-medium">{item.creator.name || item.creator.ofUsername}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            item.source === "wall_post" ? "bg-purple-500/20 text-purple-400" :
            item.source === "direct_message" ? "bg-blue-500/20 text-blue-400" :
            "bg-teal-500/20 text-teal-400"
          }`}>
            {item.source === "wall_post" ? "Wall Post" : item.source === "direct_message" ? "DM" : "Mass Msg"}
          </span>
          {!item.isFree && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">PPV</span>}
          <span className="text-xs text-white ml-auto">{item.sentAtUk}</span>
        </div>

        <p className="text-sm text-white/80 mb-3 line-clamp-3">{item.caption || "(no caption)"}</p>

        {/* Stats row */}
        {item.source === "direct_message" ? (
          <div className="flex items-center gap-3 text-xs text-white/70">
            <span className="flex items-center gap-1"><Send size={12} /> sent to {item.sentCount} fans</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-white/70">
            <span className="flex items-center gap-1"><Send size={12} /> {formatNum(item.sentCount)}</span>
            <span className="flex items-center gap-1"><Eye size={12} /> {formatNum(item.viewedCount)}</span>
            <span className={`font-medium ${item.viewRate > 1 ? "text-teal-400" : item.viewRate > 0.3 ? "text-yellow-400" : "text-red-400"}`}>
              {item.viewRate}%
            </span>
          </div>
        )}

        {/* Revenue — hero number */}
        {!item.isFree ? (
          <div className="mt-2 flex items-center justify-between">
            <div>
              <span className={`text-lg font-bold ${revenuePending ? "text-white/50 italic" : item.revenue > 0 ? "text-green-400" : "text-red-400/60"}`}>
                {revenuePending ? "Pending" : `$${item.revenue > 0 ? item.revenue.toFixed(0) : "0"}`}
              </span>
              {!revenuePending && <span className="text-[10px] text-white/60 ml-1">earned</span>}
            </div>
            <div className="text-right text-[10px] text-white">
              <div>${(item.priceCents / 100).toFixed(0)} PPV</div>
              <div>{item.purchasedCount > 0 ? `${item.purchasedCount} bought` : "No purchases yet"}</div>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-white/70">Free</span>
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

        {/* Activity — only show full graph on mass messages and wall posts */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {!item.isFree && item.purchasedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <DollarSign size={12} className="text-green-400" />
                  <span className="text-xs text-green-400 font-semibold">{item.purchasedCount} bought</span>
                </div>
              )}
              {/* Only show DMs sent on mass messages */}
              {item.source !== "direct_message" && item.wakeUp?.chatterDMs && Number(item.wakeUp.chatterDMs["60"] || 0) > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare size={10} className="text-blue-400" />
                  <span className="text-[10px] text-blue-400">{formatNum(Number(item.wakeUp.chatterDMs["60"]))} DMs followed up</span>
                </div>
              )}
            </div>
          </div>

          {/* Wake-up graph — only on mass messages and wall posts */}
          {item.source !== "direct_message" && (
            item.wakeUp?.buckets ? (
              <WakeUpBuckets buckets={item.wakeUp.buckets} totalReplied={item.wakeUp.totalReplied} ageHours={ageHours} purchasedCount={item.purchasedCount} purchaseBuckets={item.wakeUp.purchaseBuckets} />
            ) : item.wakeUp ? (
              <div className="text-[10px] text-white/50">{item.wakeUp.totalReplied} fans replied</div>
            ) : (
              <div className="text-[10px] text-white/50 italic">
                {ageHours < 0.25 ? "Just posted" : "Computing..."}
              </div>
            )
          )}
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

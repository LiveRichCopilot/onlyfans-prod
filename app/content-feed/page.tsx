"use client";

import { useEffect, useState } from "react";
import { Eye, Send, Image as ImageIcon, MessageSquare, Filter } from "lucide-react";

type MediaItem = { mediaType: string; fullUrl: string | null; previewUrl: string | null; thumbUrl: string | null; permanentUrl: string | null };
type WakeUp = { dormantBefore: number; w1h: number; w3h: number; w6h: number; w24h: number };
type ContentItem = {
  id: string;
  externalId: string;
  creator: { name: string; ofUsername: string };
  sentAt: string;
  sentAtUk: string;
  caption: string;
  isFree: boolean;
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "content" | "bump">("all");
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/team-analytics/content-feed?days=${days}`)
      .then((r) => r.json())
      .then((data) => { setItems(data.items || []); setSummary(data.summary || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

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

        <div className="flex gap-2 mb-6 flex-wrap items-center">
          <div className="flex gap-1 glass-panel rounded-xl p-1">
            {(["all", "content", "bump"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? "bg-teal-500/20 text-teal-400" : "text-white/50 hover:text-white/80"}`}>
                {f === "all" ? "All" : f === "content" ? "With Media" : "Bumps"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 glass-panel rounded-xl p-1 ml-auto">
            {[1, 3, 7, 14].map((d) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  const firstMedia = item.media[0];
  // Prefer permanentUrl (Supabase — never expires) over OF CDN URLs
  const permanentUrl = firstMedia?.permanentUrl;
  const cdnUrl = firstMedia?.previewUrl || firstMedia?.thumbUrl || firstMedia?.fullUrl;
  // If we have a permanent Supabase URL, use it directly. Otherwise proxy the CDN URL.
  const imgSrc = permanentUrl
    ? permanentUrl
    : cdnUrl
      ? `/api/proxy-media?url=${encodeURIComponent(cdnUrl)}`
      : null;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {imgSrc ? (
        <div className="relative aspect-[4/3] bg-black/40">
          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
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

        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1"><Send size={12} /> {formatNum(item.sentCount)}</span>
          <span className="flex items-center gap-1"><Eye size={12} /> {formatNum(item.viewedCount)}</span>
          <span className={`ml-auto font-medium ${item.viewRate > 1 ? "text-teal-400" : item.viewRate > 0.3 ? "text-yellow-400" : "text-red-400"}`}>
            {item.viewRate}% view rate
          </span>
        </div>

        {item.mediaCount > 0 && (
          <div className="mt-2 flex gap-1">
            {item.media.map((m, i) => (
              <span key={i} className="text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded text-white/40">
                {m.mediaType}
              </span>
            ))}
          </div>
        )}

        {item.wakeUp && item.wakeUp.dormantBefore > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 mb-1.5">
              <span className="text-amber-400">Wake-up Rate</span>
              <span>{item.wakeUp.dormantBefore} dormant fans</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([["1h", item.wakeUp.w1h], ["3h", item.wakeUp.w3h], ["6h", item.wakeUp.w6h], ["24h", item.wakeUp.w24h]] as const).map(([label, count]) => {
                const pct = item.wakeUp!.dormantBefore > 0 ? ((count / item.wakeUp!.dormantBefore) * 100).toFixed(1) : "0";
                return (
                  <div key={label} className="text-center bg-white/[0.04] rounded-lg py-1.5">
                    <div className={`text-xs font-semibold ${Number(pct) > 0 ? "text-amber-400" : "text-white/30"}`}>{pct}%</div>
                    <div className="text-[9px] text-white/30">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

"use client";

import { useMemo } from "react";
import {
  Eye, Send, Image as ImageIcon, Clock, DollarSign, XCircle,
} from "lucide-react";

type MediaItem = { mediaType: string; fullUrl: string | null; previewUrl: string | null; thumbUrl: string | null; permanentUrl: string | null };
type InsightData = { tacticTag: string; hookScore: number; insight: string; viewRate: number } | null;
export type ContentItem = {
  id: string; externalId: string;
  creator: { name: string; ofUsername: string };
  sentAt: string; sentAtUk: string; hoursLive: number; caption: string;
  isFree: boolean; priceCents: number | null; mediaCount: number;
  sentCount: number; viewedCount: number; viewRate: number;
  purchasedCount: number | null;
  dormantBefore: number | null;
  wakeUp1h: number | null; wakeUp3h: number | null; wakeUp6h: number | null; wakeUp24h: number | null;
  reactivationBuckets: Record<string, number> | null;
  isCanceled: boolean; status: "selling" | "stagnant" | "awaiting" | "free" | "unsent";
  source: string; type: "content" | "bump"; chatterName: string | null; media: MediaItem[]; insight: InsightData;
};

export function fN(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">{icon}{label}</div>
      <div className={`text-lg font-semibold ${accent ? "text-teal-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

export default function ContentCard({ item }: { item: ContentItem }) {
  const permanentUrl = item.media[0]?.permanentUrl;
  const cdnUrl = item.media[0]?.previewUrl || item.media[0]?.thumbUrl || item.media[0]?.fullUrl;
  // Use Supabase Image Transforms for fast thumbnails (auto WebP, resized on the fly)
  const imgSrc = permanentUrl
    ? permanentUrl.replace("/object/", "/render/image/") + "?width=600&quality=75"
    : cdnUrl
      ? `/api/proxy-media?url=${encodeURIComponent(cdnUrl)}`
      : null;
  const isPaid = !item.isFree && item.priceCents && item.priceCents > 0;
  const mediaSummary = useMemo(() => {
    const c: Record<string, number> = {};
    item.media.forEach((m) => { c[m.mediaType] = (c[m.mediaType] || 0) + 1; });
    return Object.entries(c).map(([t, n]) => `${n} ${t}${n > 1 ? "s" : ""}`).join(", ");
  }, [item.media]);

  const timeParts = item.sentAtUk.split(", ");
  const dateOnly = timeParts[0] || "";
  const timeOnly = (timeParts[1] || "").slice(0, 5);

  // VALIDATION: Never render this card if there's no media at all
  if (!item.media || item.media.length === 0 || item.mediaCount === 0) return null;

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${item.status === "stagnant" ? "border border-red-500/20" : ""}`}>
      {imgSrc ? (
        <div className="relative aspect-[4/3] bg-black/40">
          <img src={imgSrc} alt="" className="w-full h-full object-cover"
            onError={(e) => {
              // If image fails to load, replace with a styled fallback — never show broken img
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.parentElement?.querySelector(".img-fallback");
              if (fallback) (fallback as HTMLElement).style.display = "flex";
            }}
          />
          <div className="img-fallback hidden aspect-[4/3] bg-white/[0.04] items-center justify-center absolute inset-0">
            <ImageIcon size={32} className="text-white/30" />
          </div>
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-3">
            <div className="text-xl text-white font-bold">{timeOnly} UK</div>
            <div className="text-sm text-white/80">{dateOnly}</div>
          </div>
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
      ) : null}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-teal-400 font-semibold">{item.creator.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.source === "direct_message" ? "bg-purple-500/20 text-purple-400" : item.source === "wall_post" ? "bg-blue-500/20 text-blue-400" : "bg-white/[0.08] text-white/50"}`}>
              {item.source === "direct_message" ? "DM" : item.source === "wall_post" ? "Wall Post" : "Mass Msg"}
            </span>
          </div>
          {item.chatterName && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">{item.chatterName}</span>}
          {item.status === "selling" && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">Sold</span>}
          {item.status === "stagnant" && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">Didn&apos;t Sell</span>}
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
        {/* Reactivation — how long fans were inactive before this content woke them */}
        {item.reactivationBuckets && Object.values(item.reactivationBuckets).some(v => v > 0) && (
          <div className="mt-2 glass-inset rounded-lg p-2">
            <div className="text-xs text-white/70 mb-1 font-medium">Reactivated Fans — by inactivity</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {(["3d", "7d", "15d", "30d"] as const).map((bucket) => {
                const v = item.reactivationBuckets?.[bucket] ?? 0;
                return (
                  <div key={bucket} className="text-center">
                    <div className={`text-sm font-bold ${v > 0 ? "text-orange-400" : "text-white/30"}`}>{v}</div>
                    <div className="text-white/50">{bucket}</div>
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

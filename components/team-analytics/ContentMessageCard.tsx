"use client";

import { useState } from "react";
import { Eye, ShoppingCart, DollarSign, Send, Image, Video, Mic, Type, ChevronDown, ChevronUp, Copy, Check, Megaphone } from "lucide-react";

type MediaThumb = { url: string; type: string };

export type ReplyStats = {
  uniqueRepliers: { "30m": number; "1h": number; "6h": number; "24h": number };
  inboundMessages: { "30m": number; "1h": number; "6h": number; "24h": number };
};

export type MessageCardData = {
  id: string;
  rawText: string;
  hookCategory: string;
  hookText: string;
  contentType: string;
  mediaType: string;
  hasMedia: boolean;
  hasCTA: boolean;
  isPPV: boolean;
  isFreePreview: boolean;
  priceBucket: string;
  viewedCount: number;
  purchasedCount: number;
  sentCount: number;
  price: number;
  date: string;
  creatorName: string;
  thumbnails: MediaThumb[];
  source: "direct" | "mass";
  likelySender?: string;
  likelySenderEmail?: string;
};

const HOOK_COLORS: Record<string, string> = {
  question: "#60a5fa", teaser: "#a78bfa", personal: "#f472b6",
  urgency: "#f87171", direct_offer: "#34d399", casual: "rgba(255,255,255,0.3)",
  game: "#fbbf24", flirty: "#fb7185", other: "rgba(255,255,255,0.15)",
};

function MediaTypeIcon({ type }: { type: string }) {
  if (type === "video" || type === "gif") return <Video size={10} className="text-purple-400" />;
  if (type === "audio") return <Mic size={10} className="text-amber-400" />;
  if (type === "photo") return <Image size={10} className="text-blue-400" />;
  return <Type size={10} className="text-white/30" />;
}

function formatUKDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return `${date}, ${time}`;
}

function Pill({ label, color }: { label: string; color?: string }) {
  const bg = color || HOOK_COLORS[label] || "#5eead4";
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
      style={{ color: bg, borderColor: bg, background: `${bg}15` }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function ContentMessageCard({ msg, rank, replyStats }: { msg: MessageCardData; rank?: number; replyStats?: ReplyStats }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const revenue = msg.purchasedCount * msg.price;
  const cvrRaw = msg.viewedCount > 0 ? (msg.purchasedCount / msg.viewedCount) * 100 : 0;
  const cvr = cvrRaw < 1 && cvrRaw > 0 ? cvrRaw.toFixed(2) : Math.round(cvrRaw);
  const vrRaw = msg.sentCount > 0 ? (msg.viewedCount / msg.sentCount) * 100 : 0;
  const viewRate = vrRaw < 1 && vrRaw > 0 ? vrRaw.toFixed(2) : Math.round(vrRaw);
  const isLong = msg.rawText.length > 120;

  const copyText = () => {
    navigator.clipboard.writeText(msg.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasSales = revenue > 0;
  const hasNoBites = msg.viewedCount > 0 && msg.purchasedCount === 0 && msg.price > 0;

  return (
    <div className={`rounded-xl p-3 space-y-2.5 ${hasSales ? "bg-teal-500/[0.08] border border-teal-500/20" : "glass-inset"}`}>
      {/* Revenue banner — only when there are actual sales */}
      {hasSales && (
        <div className="flex items-center gap-2 bg-teal-500/15 rounded-lg px-3 py-1.5">
          <DollarSign size={14} className="text-teal-400" />
          <span className="text-teal-400 text-sm font-bold">${revenue.toFixed(0)}</span>
          <span className="text-teal-300/70 text-[10px]">earned</span>
          <span className="text-white/40 text-[10px] ml-1">{msg.purchasedCount} sale{msg.purchasedCount !== 1 ? "s" : ""}</span>
          {msg.viewedCount > 0 && <span className="text-white/40 text-[10px]">({cvr}% CVR)</span>}
        </div>
      )}

      {/* Row 1: Thumbnails + Text */}
      <div className="flex gap-3">
        {/* Thumbnails */}
        {msg.thumbnails.length > 0 && (
          <div className="shrink-0 flex gap-1">
            {msg.thumbnails.slice(0, 3).map((t, i) => (
              <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden bg-white/5">
                {t.type === "video" || t.type === "gif" ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src={`/api/proxy-media?url=${encodeURIComponent(t.url)}`} alt="" className="w-full h-full object-cover" />
                    <Video size={16} className="absolute text-white drop-shadow-lg" />
                  </div>
                ) : (
                  <img src={`/api/proxy-media?url=${encodeURIComponent(t.url)}`} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
            {msg.thumbnails.length > 3 && (
              <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center text-white/30 text-[10px] font-medium">
                +{msg.thumbnails.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Text + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              {rank && (
                <span className="text-[10px] font-bold text-white/40 tabular-nums">#{rank}</span>
              )}
              <span className="text-white/60 text-[10px]">{msg.creatorName}</span>
              {msg.likelySender && (
                <span className="text-white/40 text-[10px] group/sender relative cursor-default">
                  by <span className="text-teal-400/70">{msg.likelySender}</span>
                  <span className="absolute left-0 -top-6 hidden group-hover/sender:block bg-[#12141a]/95 backdrop-blur-xl border border-white/10 rounded-lg px-2 py-1 text-[9px] text-white/50 whitespace-nowrap z-10">
                    Approximate — was on shift when sent
                  </span>
                </span>
              )}
            </div>
            <span className="text-white/50 text-[10px] shrink-0">{msg.date ? formatUKDateTime(msg.date) : ""}</span>
          </div>

          {/* Full message text */}
          <div className="relative">
            <p className={`text-white/80 text-xs leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
              {msg.rawText || "(no text)"}
            </p>
            {isLong && (
              <button onClick={() => setExpanded(!expanded)} className="text-teal-400/70 text-[10px] mt-0.5 flex items-center gap-0.5 hover:text-teal-400">
                {expanded ? <><ChevronUp size={10} /> Less</> : <><ChevronDown size={10} /> Show full message</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Pill label={msg.hookCategory} />
        <Pill label={msg.contentType} color="#5eead4" />
        {msg.hasCTA && <Pill label="CTA" color="#fbbf24" />}
        {msg.price > 0 && <span className="text-teal-400 text-[10px] font-bold">${msg.price}</span>}
        {msg.price === 0 && msg.hasMedia && <Pill label="Free" color="rgba(255,255,255,0.25)" />}
        {msg.isFreePreview && <Pill label="Preview" color="rgba(255,255,255,0.25)" />}
        <div className="flex items-center gap-0.5 ml-auto">
          <MediaTypeIcon type={msg.mediaType} />
          <span className="text-white/50 text-[10px]">{msg.mediaType.replace("-", " ")}</span>
        </div>
      </div>

      {/* Row 3: Metrics */}
      <div className="flex items-center gap-3 text-[10px] text-white/60 flex-wrap">
        {msg.source === "mass" && msg.sentCount > 0 && (
          <span className="flex items-center gap-1"><Send size={9} /> <span className="text-white/80 font-medium">{msg.sentCount.toLocaleString()}</span> sent</span>
        )}
        <span className="flex items-center gap-1"><Eye size={9} /> <span className="text-white/80 font-medium">{msg.viewedCount.toLocaleString()}</span> viewed
          {msg.source === "mass" && msg.sentCount > 0 && <span className="text-white/50">({viewRate}%)</span>}
        </span>
        <span className="flex items-center gap-1"><ShoppingCart size={9} /> <span className={`font-medium ${msg.purchasedCount > 0 ? "text-teal-400" : "text-white/80"}`}>{msg.purchasedCount.toLocaleString()}</span> bought
          {msg.viewedCount > 0 && <span className="text-white/50">({cvr}%)</span>}
        </span>
        {!hasSales && msg.price > 0 && (
          <span className="flex items-center gap-1"><DollarSign size={9} /> <span className="text-white/30">$0</span></span>
        )}
        {hasNoBites && (
          <span className="text-red-400/60 text-[9px] font-medium">No sales yet</span>
        )}
        <button onClick={copyText} className="ml-auto text-white/30 hover:text-white/60 transition" title="Copy message text">
          {copied ? <Check size={11} className="text-teal-400" /> : <Copy size={11} />}
        </button>
      </div>

      {/* Row 4: Reply attribution (if available) */}
      {replyStats && replyStats.uniqueRepliers["24h"] > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
          <span className="text-[9px] text-white/50 shrink-0">Fans replied:</span>
          {(["30m", "1h", "6h", "24h"] as const).map(w => (
            <span key={w} className={`text-[9px] px-1.5 py-0.5 rounded ${replyStats.uniqueRepliers[w] > 0 ? "bg-teal-400/10 text-teal-400" : "bg-white/5 text-white/30"}`}>
              {w}: <span className="font-semibold">{replyStats.uniqueRepliers[w]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentEmptyState({ message }: { message?: string }) {
  return (
    <div className="h-[160px] flex items-center justify-center text-white/30 text-sm">
      <Megaphone size={14} className="mr-2 opacity-50" /> {message || "No engagement data available"}
    </div>
  );
}

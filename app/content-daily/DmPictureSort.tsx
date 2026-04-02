"use client";

import { useState } from "react";
import { ChevronDown, DollarSign, CheckCircle, XCircle, Clock, User, Zap } from "lucide-react";
import type { ContentItem } from "./ContentCard";
import DmMediaLightbox from "./DmMediaLightbox";

function FanLabel({ label }: { label: string }) {
  const cls = label === "SVIP" ? "text-yellow-300 bg-yellow-500/20"
    : label === "Diamond" ? "text-cyan-300 bg-cyan-500/20"
    : label === "VIP" ? "text-purple-300 bg-purple-500/20"
    : label === "Whale" ? "text-emerald-300 bg-emerald-500/20"
    : label === "At Risk" ? "text-red-300 bg-red-500/20"
    : "text-white/60 bg-white/10";
  return <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${cls}`}>{label}</span>;
}

function Thumb({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const perm = item.media[0]?.permanentUrl;
  const cdn = item.media[0]?.previewUrl || item.media[0]?.thumbUrl || item.media[0]?.fullUrl;
  const src = perm
    ? perm.replace("/object/", "/render/image/") + "?width=300&quality=70"
    : cdn ? `/api/proxy-media?url=${encodeURIComponent(cdn)}` : null;

  const isSold = item.status === "selling";
  const isVideo = item.media[0]?.mediaType === "video";

  return (
    <div onClick={onClick}
      className={`relative rounded-xl overflow-hidden bg-black/40 group cursor-pointer ${isSold ? "ring-[3px] ring-emerald-500" : "ring-1 ring-white/10"}`}>
      {src ? (
        <img src={src} alt="" className="w-full aspect-[3/4] object-cover" />
      ) : (
        <div className="w-full aspect-[3/4] bg-white/[0.04] flex items-center justify-center text-white/20 text-xs">No img</div>
      )}
      {/* Video indicator */}
      {isVideo && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 rounded-full w-8 h-8 flex items-center justify-center">
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
        </div>
      )}
      {/* Price badge */}
      {!item.isFree && item.priceCents && item.priceCents > 0 && (
        <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
          <DollarSign size={9} />{(item.priceCents / 100).toFixed(0)}
        </span>
      )}
      {/* Sold overlay */}
      {isSold && (
        <>
          <div className="absolute top-1.5 left-1.5"><CheckCircle size={16} className="text-emerald-400 drop-shadow-lg" /></div>
          <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 px-2 py-1 flex items-center justify-between">
            <span className="text-[10px] text-white font-bold">${((item.priceCents || 0) / 100).toFixed(0)} SOLD</span>
            <span className="text-[9px] text-white/80">{item.sentAtUk.split(", ")[1]?.slice(0, 5) || ""}</span>
          </div>
        </>
      )}
      {!isSold && item.status === "stagnant" && (
        <div className="absolute top-1.5 left-1.5"><XCircle size={16} className="text-red-400 drop-shadow-lg" /></div>
      )}
      {!isSold && item.status === "awaiting" && (
        <div className="absolute top-1.5 left-1.5"><Clock size={14} className="text-yellow-400 drop-shadow-lg" /></div>
      )}
      {/* Multi-media count */}
      {item.media.length > 1 && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full">+{item.media.length - 1}</span>
      )}
      {/* Insight score badge */}
      {item.insight && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5">
          <Zap size={9} className="text-teal-400" />
          <span className="text-[8px] text-teal-400 font-bold">{item.insight.hookScore}</span>
        </div>
      )}
      {/* Hover overlay with fan info */}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
        <div className="text-[10px] text-teal-400 font-medium truncate">{item.creator.name}</div>
        {item.chatterName && <div className="text-[10px] text-orange-400 truncate">{item.chatterName}</div>}
        {item.fanUsername && (
          <div className="text-[10px] text-white/80 truncate flex items-center gap-1">
            <span>@{item.fanUsername}</span>
            {item.fanLabel && <FanLabel label={item.fanLabel} />}
          </div>
        )}
        {item.fanName && !item.fanUsername && <div className="text-[10px] text-white/60 truncate">{item.fanName}</div>}
        <div className="text-[10px] text-white/60">{item.sentAtUk.split(", ")[1]?.slice(0, 5) || ""}</div>
        {item.purchasedCount != null && item.purchasedCount > 0 && (
          <div className="text-[10px] text-emerald-400 font-bold">{item.purchasedCount} bought</div>
        )}
        {item.insight && (
          <div className="text-[9px] text-teal-400/80 truncate mt-0.5">{item.insight.tacticTag.replace(/_/g, " ")} — {item.insight.insight}</div>
        )}
      </div>
    </div>
  );
}

function Section({
  title, icon, count, color, items, defaultOpen, revenue, onThumbClick,
}: {
  title: string; icon: React.ReactNode; count: number; color: string;
  items: ContentItem[]; defaultOpen?: boolean; revenue?: number;
  onThumbClick: (item: ContentItem) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 py-2 text-left">
        {icon}
        <span className={`text-sm font-semibold ${color}`}>{title}</span>
        <span className="text-xs text-white/40">{count}</span>
        {revenue != null && revenue > 0 && (
          <span className="text-xs text-emerald-400 font-bold flex items-center gap-0.5 ml-1">
            <DollarSign size={10} />{revenue.toFixed(0)}
          </span>
        )}
        <ChevronDown size={14} className={`ml-auto text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {items.map((item) => <Thumb key={item.id} item={item} onClick={() => onThumbClick(item)} />)}
        </div>
      )}
    </div>
  );
}

export default function DmPictureSort({ items }: { items: ContentItem[] }) {
  const [view, setView] = useState<"status" | "chatter">("status");
  const [lightboxItem, setLightboxItem] = useState<ContentItem | null>(null);

  const dmItems = items.filter((i) => i.source === "direct_message");
  if (dmItems.length === 0) return null;

  const sold = dmItems.filter((i) => i.status === "selling");
  const didntSell = dmItems.filter((i) => i.status === "stagnant");
  const pending = dmItems.filter((i) => i.status === "awaiting");
  const free = dmItems.filter((i) => i.status === "free");

  const chatterMap = new Map<string, ContentItem[]>();
  for (const item of dmItems) {
    const key = item.chatterName || "Unassigned";
    const arr = chatterMap.get(key) || [];
    arr.push(item);
    chatterMap.set(key, arr);
  }
  const chatters = [...chatterMap.entries()].sort((a, b) => {
    const aSold = a[1].filter((i) => i.status === "selling").length;
    const bSold = b[1].filter((i) => i.status === "selling").length;
    return bSold - aSold || b[1].length - a[1].length;
  });

  const openLightbox = (item: ContentItem) => setLightboxItem(item);

  return (
    <>
      <div className="glass-card rounded-2xl mb-6 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">DM Picture Sort</h3>
          <div className="flex gap-1 glass-panel rounded-lg p-0.5">
            <button onClick={() => setView("status")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === "status" ? "bg-teal-500/20 text-teal-400" : "text-white/50"}`}>
              Sold / Not Sold
            </button>
            <button onClick={() => setView("chatter")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === "chatter" ? "bg-purple-500/20 text-purple-400" : "text-white/50"}`}>
              By Chatter
            </button>
          </div>
        </div>

        {view === "status" && (
          <>
            <Section title="Sold" icon={<CheckCircle size={14} className="text-emerald-400" />}
              count={sold.length} color="text-emerald-400" items={sold} defaultOpen={true}
              revenue={sold.reduce((s, i) => s + ((i.priceCents || 0) / 100), 0)} onThumbClick={openLightbox} />
            <Section title="Didn't Sell" icon={<XCircle size={14} className="text-red-400" />}
              count={didntSell.length} color="text-red-400" items={didntSell} defaultOpen={didntSell.length <= 50} onThumbClick={openLightbox} />
            <Section title="Pending" icon={<Clock size={14} className="text-yellow-400" />}
              count={pending.length} color="text-yellow-400" items={pending} onThumbClick={openLightbox} />
            {free.length > 0 && (
              <Section title="Free" icon={<User size={14} className="text-white/50" />}
                count={free.length} color="text-white/50" items={free} onThumbClick={openLightbox} />
            )}
          </>
        )}

        {view === "chatter" && (
          <>
            {chatters.map(([name, chatterItems]) => {
              const chSold = chatterItems.filter((i) => i.status === "selling").length;
              const chRevenue = chatterItems
                .filter((i) => i.status === "selling")
                .reduce((s, i) => s + ((i.priceCents || 0) / 100), 0);
              const isBot = name !== "Unassigned";
              return (
                <Section key={name}
                  title={`${name}${chSold > 0 ? ` — ${chSold} sold` : ""}`}
                  icon={<User size={14} className={isBot ? "text-purple-400" : "text-white/40"} />}
                  count={chatterItems.length} color={isBot ? "text-purple-400" : "text-white/40"}
                  items={chatterItems} defaultOpen={chSold > 0} revenue={chRevenue} onThumbClick={openLightbox}
                />
              );
            })}
          </>
        )}
      </div>
      {lightboxItem && <DmMediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
    </>
  );
}

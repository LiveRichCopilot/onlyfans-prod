"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Play, Zap } from "lucide-react";
import type { ContentItem } from "./ContentCard";

type MediaItem = { mediaType: string; fullUrl: string | null; previewUrl: string | null; thumbUrl: string | null; permanentUrl: string | null };

function mediaUrl(m: MediaItem, full = false): string | null {
  if (m.mediaType === "video") {
    // For videos: permanentUrl is just a thumbnail — use CDN fullUrl for actual video playback
    const videoSrc = m.fullUrl || m.previewUrl;
    if (videoSrc) return `/api/proxy-media?url=${encodeURIComponent(videoSrc)}`;
    if (m.permanentUrl) return m.permanentUrl; // fallback to thumbnail
    return null;
  }
  if (m.permanentUrl) {
    return full ? m.permanentUrl : m.permanentUrl.replace("/object/", "/render/image/") + "?width=900&quality=85";
  }
  const cdn = m.fullUrl || m.previewUrl || m.thumbUrl;
  return cdn ? `/api/proxy-media?url=${encodeURIComponent(cdn)}` : null;
}

export default function DmMediaLightbox({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const media = item.media;
  const current = media[idx];

  const prev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : media.length - 1)), [media.length]);
  const next = useCallback(() => setIdx((i) => (i < media.length - 1 ? i + 1 : 0)), [media.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  if (!current) return null;
  const src = mediaUrl(current, true);
  const isVideo = current.mediaType === "video";
  const labelColor = item.fanLabel === "SVIP" ? "text-yellow-300 bg-yellow-500/20"
    : item.fanLabel === "Diamond" ? "text-cyan-300 bg-cyan-500/20"
    : item.fanLabel === "VIP" ? "text-purple-300 bg-purple-500/20"
    : item.fanLabel === "Whale" ? "text-emerald-300 bg-emerald-500/20"
    : item.fanLabel === "At Risk" ? "text-red-300 bg-red-500/20"
    : "text-white/60 bg-white/10";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 glass-card rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-teal-400 font-semibold shrink-0">{item.creator.name}</span>
            {item.chatterName && <span className="text-xs text-orange-400 shrink-0">by {item.chatterName}</span>}
            {item.fanUsername && (
              <span className="text-xs text-white/70 truncate">to @{item.fanUsername}{item.fanName ? ` (${item.fanName})` : ""}</span>
            )}
            {item.fanLabel && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${labelColor}`}>{item.fanLabel}</span>}
            {item.fanSpend != null && item.fanSpend > 0 && (
              <span className="text-[10px] text-emerald-400/70">${item.fanSpend.toFixed(0)} LTV</span>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Media */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[60vh]">
          {isVideo && src ? (
            <video src={src} controls autoPlay className="max-w-full max-h-[60vh] object-contain" />
          ) : src ? (
            <img src={src} alt="" className="max-w-full max-h-[60vh] object-contain" />
          ) : (
            <div className="text-white/30 text-sm">No media available</div>
          )}
          {media.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><ChevronLeft size={20} /></button>
              <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"><ChevronRight size={20} /></button>
            </>
          )}
          {media.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-xs text-white/80">
              {idx + 1} / {media.length}
              {current.mediaType === "video" && <Play size={10} className="inline ml-1" />}
            </div>
          )}
        </div>

        {/* Footer — caption + insight */}
        <div className="p-3 glass-card rounded-b-2xl space-y-2">
          {item.caption && <p className="text-sm text-white/80">{item.caption}</p>}
          {!item.caption && <p className="text-sm text-white/30 italic">No caption</p>}
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span>{item.sentAtUk}</span>
            {item.priceCents && item.priceCents > 0 && <span className="text-teal-400 font-bold">${(item.priceCents / 100).toFixed(0)} PPV</span>}
            {item.status === "selling" && <span className="text-emerald-400 font-bold">SOLD</span>}
            {item.status === "stagnant" && <span className="text-red-400">Not Sold</span>}
          </div>
          {item.insight && (
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-teal-400 shrink-0" />
              <span className="text-xs text-teal-400">{item.insight.tacticTag.replace(/_/g, " ")}</span>
              <span className="text-xs text-white/40">Score: {item.insight.hookScore}</span>
              <span className="text-xs text-white/50 truncate">{item.insight.insight}</span>
            </div>
          )}
          {/* Thumbnail strip */}
          {media.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pt-1">
              {media.map((m, i) => {
                const thumbSrc = m.permanentUrl
                  ? m.permanentUrl.replace("/object/", "/render/image/") + "?width=80&quality=60"
                  : m.thumbUrl || m.previewUrl ? `/api/proxy-media?url=${encodeURIComponent(m.thumbUrl || m.previewUrl || "")}` : null;
                return (
                  <button key={i} onClick={() => setIdx(i)}
                    className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 ring-2 ${i === idx ? "ring-teal-400" : "ring-transparent"}`}>
                    {thumbSrc ? <img src={thumbSrc} alt="" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        {m.mediaType === "video" ? <Play size={10} className="text-white/40" /> : <span className="text-[8px] text-white/30">?</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

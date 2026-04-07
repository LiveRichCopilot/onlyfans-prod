"use client";

import type { Caption } from "./ContentPlan";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time}`;
}

export function CaptionsPerformedSuccessfully({ captions }: { captions: Caption[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Captions That Performed Successfully
      </div>
      {captions.length === 0 ? (
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No winning captions yet in this window.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {captions.map((c, i) => (
            <div
              key={i}
              className="glass-panel rounded-2xl overflow-hidden border border-teal-500/20 hover:border-teal-500/40 transition"
            >
              {c.thumbnailUrl ? (
                <div className="relative aspect-[4/5] bg-black/40 overflow-hidden">
                  <img
                    src={`/api/proxy-media?url=${encodeURIComponent(c.thumbnailUrl)}`}
                    alt="Mass message preview"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-teal-500/90 text-black text-[10px] font-bold uppercase tracking-widest">
                    #{i + 1} · {fmtMoney(c.earned)} earned
                  </div>
                  {c.lastPriceDollars !== null && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/70 text-white text-[10px] font-bold">
                      {fmtMoney(c.lastPriceDollars)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/5] bg-gradient-to-br from-teal-900/30 to-black/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mb-1">
                      #{i + 1}
                    </div>
                    <div className="text-2xl font-bold text-teal-300">{fmtMoney(c.earned)}</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">earned</div>
                  </div>
                </div>
              )}
              <div className="p-4">
                <div className="text-[10px] text-teal-300/80 font-semibold uppercase tracking-widest mb-2">
                  Last sent · {fmtDateTime(c.lastUsed)}
                </div>
                <div className="text-sm text-white/90 mb-3 line-clamp-3">{c.text}</div>
                <div className="grid grid-cols-3 gap-2 text-xs border-t border-white/10 pt-3">
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Sends</div>
                    <div className="text-white/80 font-semibold">{c.sends.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Bought</div>
                    <div className="text-white/80 font-semibold">{c.purchases.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Times used</div>
                    <div className="text-white/80 font-semibold">{c.timesUsed}×</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

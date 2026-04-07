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

export function CaptionsPerformedPoorly({ captions }: { captions: Caption[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Captions That Performed Poorly
      </div>
      {captions.length === 0 ? (
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No flops in this window — every caption that sent earned something.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {captions.map((c, i) => (
            <div
              key={i}
              className="glass-panel rounded-2xl overflow-hidden border border-white/10 opacity-80"
            >
              {c.thumbnailUrl ? (
                <div className="relative aspect-[4/5] bg-black/40 overflow-hidden">
                  <img
                    src={`/api/proxy-media?url=${encodeURIComponent(c.thumbnailUrl)}`}
                    alt="Mass message preview"
                    className="w-full h-full object-cover grayscale"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/70 text-white/70 text-[10px] font-bold uppercase tracking-widest">
                    Flop #{i + 1}
                  </div>
                  {c.lastPriceDollars !== null && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/70 text-white/70 text-[10px] font-bold">
                      {fmtMoney(c.lastPriceDollars)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/5] bg-gradient-to-br from-white/5 to-black/40 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">
                      Flop #{i + 1}
                    </div>
                    <div className="text-2xl font-bold text-white/50">$0</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">earned</div>
                  </div>
                </div>
              )}
              <div className="p-4">
                <div className="text-[10px] text-white/50 font-semibold uppercase tracking-widest mb-2">
                  Last sent · {fmtDateTime(c.lastUsed)}
                </div>
                <div className="text-sm text-white/70 mb-3 line-clamp-3">{c.text}</div>
                <div className="grid grid-cols-3 gap-2 text-xs border-t border-white/10 pt-3">
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Sends</div>
                    <div className="text-white/80 font-semibold">{c.sends.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Bought</div>
                    <div className="text-white/60 font-semibold">0</div>
                  </div>
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Times used</div>
                    <div className="text-white/60 font-semibold">{c.timesUsed}×</div>
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

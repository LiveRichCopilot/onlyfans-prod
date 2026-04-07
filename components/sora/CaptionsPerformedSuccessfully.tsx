"use client";

import type { Caption } from "./ContentPlan";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CaptionsPerformedSuccessfully({ captions }: { captions: Caption[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Captions That Performed Successfully
      </div>
      {captions.length === 0 ? (
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No winning captions with 2+ sends in this window yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {captions.map((c, i) => (
            <div
              key={i}
              className="glass-panel rounded-2xl p-5 border border-teal-500/20 hover:border-teal-500/40 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-teal-400 font-bold uppercase tracking-widest">#{i + 1}</div>
                {c.lastPriceDollars !== null && (
                  <div className="text-xs text-white/50">{fmtMoney(c.lastPriceDollars)}</div>
                )}
              </div>
              <div className="text-sm text-white/90 mb-4 line-clamp-4">{c.text}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Earned / Send</div>
                  <div className="text-teal-300 font-bold text-sm">{fmtMoney(c.earnedPerSend)}</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Purchases</div>
                  <div className="text-white font-bold text-sm">{c.purchases.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Sends</div>
                  <div className="text-white/70 text-sm">{c.sends.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Used</div>
                  <div className="text-white/70 text-sm">
                    {c.timesUsed}× · {fmtDate(c.lastUsed)}
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

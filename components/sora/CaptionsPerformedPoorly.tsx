"use client";

import type { Caption } from "./ContentPlan";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CaptionsPerformedPoorly({ captions }: { captions: Caption[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Captions That Performed Poorly
      </div>
      {captions.length === 0 ? (
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No flops in this window — every caption that sent twice got at least one purchase.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {captions.map((c, i) => (
            <div
              key={i}
              className="glass-panel rounded-2xl p-5 border border-white/10 opacity-80"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-white/40 font-bold uppercase tracking-widest">Flop #{i + 1}</div>
                {c.lastPriceDollars !== null && (
                  <div className="text-xs text-white/50">{fmtMoney(c.lastPriceDollars)}</div>
                )}
              </div>
              <div className="text-sm text-white/70 mb-4 line-clamp-4">{c.text}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Sends</div>
                  <div className="text-white/80 font-bold text-sm">{c.sends.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Purchases</div>
                  <div className="text-white/60 text-sm">0</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Times Used</div>
                  <div className="text-white/60 text-sm">{c.timesUsed}×</div>
                </div>
                <div>
                  <div className="text-white/40 uppercase tracking-widest text-[9px]">Last Sent</div>
                  <div className="text-white/60 text-sm">{fmtDate(c.lastUsed)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

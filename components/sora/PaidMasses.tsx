"use client";

import type { PaidMass } from "./ContentPlan";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
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

export function PaidMasses({ masses }: { masses: PaidMass[] }) {
  if (masses.length === 0) {
    return (
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Paid Masses
        </div>
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No paid masses in this window.
        </div>
      </div>
    );
  }

  const earners = masses.filter((m) => m.earned > 0);
  const flops = masses.filter((m) => m.earned === 0);
  const best = earners[0] || null;

  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Paid Masses — ranked by money earned
      </div>
      <div className="space-y-3">
        {earners.map((m) => {
          const isBest = best && m.id === best.id;
          return (
            <div
              key={m.id}
              className={
                "glass-panel rounded-2xl border overflow-hidden flex flex-col md:flex-row " +
                (isBest ? "border-teal-500/50 bg-teal-500/5" : "border-white/10")
              }
            >
              {m.thumbnailUrl ? (
                <div className="md:w-48 md:flex-shrink-0 bg-black/40">
                  <img
                    src={`/api/proxy-media?url=${encodeURIComponent(m.thumbnailUrl)}`}
                    alt="Mass preview"
                    className="w-full h-48 md:h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="md:w-48 md:flex-shrink-0 h-48 bg-gradient-to-br from-teal-900/20 to-black/40 flex items-center justify-center">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest">No preview</div>
                </div>
              )}
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[10px] text-teal-300 font-bold uppercase tracking-widest">
                      {fmtDateTime(m.sentAt)}
                    </div>
                    <div className="text-3xl font-bold text-white tracking-tight mt-1">
                      {fmtMoney(m.earned)}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">
                      earned
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Price</div>
                    <div className="text-2xl font-bold text-white">{fmtMoney(m.priceDollars)}</div>
                  </div>
                </div>
                <div className="text-sm text-white/80 mb-4 line-clamp-2">{m.caption || "—"}</div>
                <div className="grid grid-cols-2 gap-3 text-xs border-t border-white/10 pt-3">
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Purchases</div>
                    <div className="text-white font-bold text-base">{m.purchases.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-white/40 uppercase tracking-widest text-[9px]">Sends</div>
                    <div className="text-white/70 text-base">{m.sends.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {flops.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
            Paid Masses with $0 Earned ({flops.length})
          </div>
          <div className="space-y-2">
            {flops.map((m) => (
              <div
                key={m.id}
                className="glass-panel rounded-xl border border-white/10 p-4 opacity-70 flex items-center gap-4"
              >
                {m.thumbnailUrl ? (
                  <img
                    src={`/api/proxy-media?url=${encodeURIComponent(m.thumbnailUrl)}`}
                    alt="Mass preview"
                    className="w-16 h-16 rounded-lg object-cover grayscale flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">
                    {fmtDateTime(m.sentAt)} · {fmtMoney(m.priceDollars)}
                  </div>
                  <div className="text-sm text-white/70 truncate">{m.caption || "—"}</div>
                  <div className="text-[10px] text-white/40 mt-1">
                    {m.sends.toLocaleString()} sends · 0 purchases
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

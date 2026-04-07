"use client";

import type { Suggested } from "./ContentPlan";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time}`;
}

export function SuggestedPricePoints({ suggested }: { suggested: Suggested[] }) {
  if (suggested.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-teal-300/80 uppercase tracking-widest mb-3">
        Suggested Price Points — try these this week
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {suggested.map((s, i) => (
          <div
            key={i}
            className="glass-panel rounded-2xl p-5 border border-teal-500/30 bg-teal-500/5"
          >
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-4xl font-bold text-white tracking-tight">
                {fmtMoney(s.priceDollars)}
              </div>
              <div className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">
                Suggestion #{i + 1}
              </div>
            </div>
            <div className="text-sm font-semibold text-white/90 mb-2">{s.reason}</div>
            <div className="text-xs text-white/60 mb-3">{s.stat}</div>
            {s.lastUsedAt && (
              <div className="text-[10px] text-white/40 uppercase tracking-widest border-t border-white/10 pt-2">
                Last sent · {fmtDateTime(s.lastUsedAt)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

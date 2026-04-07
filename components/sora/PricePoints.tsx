"use client";

import type { PricePoint } from "./ContentPlan";

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

export function PricePoints({
  pricePoints,
  pricePointsNoEarnings,
}: {
  pricePoints: PricePoint[];
  pricePointsNoEarnings: PricePoint[];
}) {
  if (pricePoints.length === 0 && pricePointsNoEarnings.length === 0) {
    return (
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Price Points</div>
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No paid masses in this window.
        </div>
      </div>
    );
  }

  const best = pricePoints[0];

  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Price Points — ranked by money earned in 14 days
      </div>
      {pricePoints.length > 0 ? (
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase tracking-widest">
                <th className="text-left px-4 py-3 font-semibold">Price</th>
                <th className="text-right px-4 py-3 font-semibold">Earned</th>
                <th className="text-right px-4 py-3 font-semibold">Purchases</th>
                <th className="text-right px-4 py-3 font-semibold">Sends</th>
                <th className="text-right px-4 py-3 font-semibold">Paid Masses</th>
                <th className="text-right px-4 py-3 font-semibold">Last Sent</th>
              </tr>
            </thead>
            <tbody>
              {pricePoints.map((p) => {
                const isBest = p.priceDollars === best.priceDollars;
                return (
                  <tr
                    key={p.priceDollars}
                    className={
                      "border-b border-white/5 last:border-0 " +
                      (isBest ? "bg-teal-500/10" : "hover:bg-white/5")
                    }
                  >
                    <td className="px-4 py-3 font-bold text-white">{fmtMoney(p.priceDollars)}</td>
                    <td className={"px-4 py-3 text-right font-bold text-lg " + (isBest ? "text-teal-300" : "text-white")}>
                      {fmtMoney(p.earned)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70">{p.purchases.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white/70">{p.sends.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white/70">{p.massesSent}</td>
                    <td className="px-4 py-3 text-right text-white/60 text-xs">{fmtDateTime(p.lastUsedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No price points earned money in this window yet.
        </div>
      )}

      {pricePointsNoEarnings.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] text-white/40 uppercase tracking-widest mb-2">
            Price points with $0 earned ({pricePointsNoEarnings.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {pricePointsNoEarnings.map((p) => (
              <div
                key={p.priceDollars}
                className="glass-panel rounded-xl border border-white/10 px-3 py-2 text-xs opacity-60"
              >
                <span className="font-bold text-white/70">{fmtMoney(p.priceDollars)}</span>
                <span className="text-white/40 ml-2">
                  {p.sends.toLocaleString()} sends · last sent {fmtDateTime(p.lastUsedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

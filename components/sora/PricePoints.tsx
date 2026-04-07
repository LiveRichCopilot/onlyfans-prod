"use client";

import type { PricePoint } from "./ContentPlan";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function PricePoints({ pricePoints }: { pricePoints: PricePoint[] }) {
  if (pricePoints.length === 0) {
    return (
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Price Points</div>
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No paid masses with price data in this window.
        </div>
      </div>
    );
  }

  const best = pricePoints[0];

  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Price Points</div>
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase tracking-widest">
              <th className="text-left px-4 py-3 font-semibold">Price</th>
              <th className="text-right px-4 py-3 font-semibold">Paid Masses</th>
              <th className="text-right px-4 py-3 font-semibold">Sends</th>
              <th className="text-right px-4 py-3 font-semibold">Purchases</th>
              <th className="text-right px-4 py-3 font-semibold">Buy Rate</th>
              <th className="text-right px-4 py-3 font-semibold">Earned</th>
              <th className="text-right px-4 py-3 font-semibold">Earned / Send</th>
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
                  <td className="px-4 py-3 text-right text-white/70">{p.massesSent}</td>
                  <td className="px-4 py-3 text-right text-white/70">{p.sends.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-white/70">{p.purchases.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-white/70">{fmtPct(p.purchaseRate)}</td>
                  <td className="px-4 py-3 text-right text-white/70">{fmtMoney(p.earned)}</td>
                  <td className={"px-4 py-3 text-right font-bold " + (isBest ? "text-teal-300" : "text-white")}>
                    {fmtMoney(p.earnedPerSend)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-white/40 mt-2">
        Sorted by earned per send. Highest earner highlighted.
      </div>
    </div>
  );
}

"use client";

import type { PricePointsResponse } from "./ContentPlan";
import { SuggestedPricePoints } from "./SuggestedPricePoints";
import { PaidMasses } from "./PaidMasses";
import { PatternsWereMissing } from "./PatternsWereMissing";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 border border-white/10">
      <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

export function MassMessageStatistics({
  data,
  loading,
  error,
}: {
  data: PricePointsResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <div className="glass-panel rounded-3xl p-8 border border-red-500/30">
        <div className="text-xs text-red-400 uppercase tracking-widest font-semibold mb-2">Error</div>
        <div className="text-white/80 text-sm">{error}</div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center">
        <div className="text-white/50 text-sm">Loading mass message statistics…</div>
      </div>
    );
  }

  if (data.paidMassCount === 0) {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center">
        <div className="text-white/60">
          No paid masses sent in the last {data.windowDays} days for this model.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Mass Message Statistics — last {data.windowDays} days
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Earned" value={fmtMoney(data.totalEarned)} />
          <StatCard label="Purchases" value={data.totalPurchases.toLocaleString()} />
          <StatCard label="Sends" value={data.totalSends.toLocaleString()} />
          <StatCard label="Paid Masses" value={String(data.paidMassCount)} />
        </div>
        {data.rowsMissingPrice > 0 && (
          <div className="mt-3 text-[11px] text-yellow-300/80">
            Note: {data.rowsMissingPrice} mass message{data.rowsMissingPrice === 1 ? "" : "s"} had no price data in the backfill. These aren't counted.
          </div>
        )}
      </div>

      <SuggestedPricePoints suggested={data.suggestedPricePoints} />

      <PaidMasses masses={data.paidMasses} />

      <PatternsWereMissing patterns={data.patterns} />
    </div>
  );
}

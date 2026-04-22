import type { SaleTypeRow } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  tip: "Tips",
  message: "PPV messages",
  post: "Post purchases",
  stream: "Stream",
  subscription: "Subscriptions",
  referral: "Referral",
  unknown: "Other",
};

export function SaleBreakdown({ rows }: { rows: SaleTypeRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">How the money came in</h2>
      <p className="mt-1 text-sm text-white/50">Revenue by sale type (≥ $25 only)</p>

      <div className="mt-4 glass-card rounded-2xl p-4 sm:p-5 space-y-4">
        {rows.map((r) => (
          <div key={r.type}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm text-white/90 font-medium">
                {TYPE_LABELS[r.type] || r.type}
              </div>
              <div className="text-sm text-white/60">
                <span className="text-white font-semibold">{fmtUSD(r.revenue)}</span>
                <span className="text-white/40"> · {r.count.toLocaleString()} sales</span>
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400/80 to-teal-500/60"
                style={{ width: `${Math.max(2, r.pctOfRevenue)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-white/40">{r.pctOfRevenue.toFixed(1)}% of revenue</div>
          </div>
        ))}
      </div>
    </section>
  );
}

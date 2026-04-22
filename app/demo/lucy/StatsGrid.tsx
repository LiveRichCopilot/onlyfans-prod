import type { Stats } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">{label}</div>
      <div className="mt-1 text-2xl sm:text-3xl font-semibold text-white tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

export function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <Card label="Sales" value={stats.saleCount.toLocaleString()} sub="$25 and up" />
      <Card label="Revenue" value={fmtUSD(stats.revenue)} sub={`from ${stats.uniqueFans} fans`} />
      <Card label="Avg sale" value={fmtUSD(stats.avgSale)} />
      <Card label="Date range" value={fmtDate(stats.dateStart)} sub={`to ${fmtDate(stats.dateEnd)}`} />
    </div>
  );
}

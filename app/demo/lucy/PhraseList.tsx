import { Quote } from "lucide-react";
import type { PhraseRow } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PhraseList({
  title,
  subtitle,
  rows,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  rows: PhraseRow[];
  emptyLabel: string;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <Quote size={18} className="text-teal-300/80" />
        <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-white/50">{subtitle}</p>

      {rows.length === 0 ? (
        <div className="mt-4 glass-card rounded-2xl p-5 text-sm text-white/50">{emptyLabel}</div>
      ) : (
        <div className="mt-4 glass-card rounded-2xl divide-y divide-white/5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-4 p-4 sm:p-5">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/40 font-mono">#{i + 1}</div>
                <p className="mt-1 text-[15px] text-white/95 leading-snug break-words">
                  &ldquo;{r.text}&rdquo;
                </p>
                <div className="mt-1 text-xs text-white/40">
                  {r.occurrences} times · {fmtUSD(r.totalRevenue)} total
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg sm:text-xl font-semibold text-teal-300 tracking-tight">
                  {fmtUSD(r.avgRevenue)}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">avg / use</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

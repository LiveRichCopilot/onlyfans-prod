/**
 * CategoryBar — Progress bar for a scoring category (SLA, Follow-up, etc.)
 */

export function CategoryBar({
  label,
  score,
  max,
  icon,
}: {
  label: string;
  score: number;
  max: number;
  icon: React.ReactNode;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2.5">
      <div className="text-white/30 w-4 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/50 text-[11px]">{label}</span>
          <span className="text-white/70 text-[11px] font-medium">
            {score}/{max}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${color} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

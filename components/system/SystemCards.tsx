export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-bold text-teal-400/70 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
          {number}
        </span>
        <h2 className="text-xl font-bold text-white/90">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-white/40 ml-11">{subtitle}</p>
      )}
    </div>
  );
}

export function TrackingCategory({
  icon,
  title,
  items,
  accent = "teal",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  accent?: string;
}) {
  const accentMap: Record<string, string> = {
    teal: "from-teal-500/20 to-teal-500/5 border-teal-500/20",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/20",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-500/20",
    indigo: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/20",
  };
  const colors = accentMap[accent] || accentMap.teal;

  return (
    <div className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${colors}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
          {icon}
        </div>
        <h3 className="font-semibold text-white/90 text-sm">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="text-xs text-white/60 flex items-start gap-2"
          >
            <span className="text-white/20 mt-0.5">-</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DataFlowCard({
  icon,
  title,
  timing,
  accentColor,
  events,
  updates,
}: {
  icon: React.ReactNode;
  title: string;
  timing: string;
  accentColor: string;
  events: string[];
  updates: string[];
}) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`p-2.5 rounded-xl border`}
          style={{
            borderColor: `${accentColor}33`,
            backgroundColor: `${accentColor}15`,
          }}
        >
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-white/90">{title}</h3>
          <p className="text-xs text-white/40 italic">{timing}</p>
        </div>
      </div>
      <div className="space-y-3 mt-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
            Events
          </div>
          <div className="flex flex-wrap gap-1.5">
            {events.map((e) => (
              <span
                key={e}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 font-mono"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
            Updates
          </div>
          <div className="flex flex-wrap gap-1.5">
            {updates.map((u) => (
              <span
                key={u}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60"
              >
                {u}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

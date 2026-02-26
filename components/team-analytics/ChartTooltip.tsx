"use client";

export function GlassTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#12141a]/95 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-[10px] text-white/40 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color || "#2DD4BF" }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

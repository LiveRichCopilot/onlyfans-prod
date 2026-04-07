"use client";

type Model = {
  id: string;
  name: string;
  ofUsername: string | null;
  avatarUrl: string | null;
};

export function Models({
  models,
  selectedId,
  onSelect,
}: {
  models: Model[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Models</div>
      <div className="flex flex-wrap gap-3">
        {models.map((m) => {
          const isSelected = m.id === selectedId;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={
                "flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition " +
                (isSelected
                  ? "bg-teal-500/20 border-teal-500/50 text-white shadow-lg shadow-teal-900/30"
                  : "glass-panel border-white/10 text-white/70 hover:text-white hover:border-white/30")
              }
            >
              {m.avatarUrl ? (
                <img
                  src={`/api/proxy-media?url=${encodeURIComponent(m.avatarUrl)}`}
                  alt={m.name}
                  className="w-8 h-8 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs border border-white/20">
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="text-sm font-semibold">{m.name}</div>
                {m.ofUsername && (
                  <div className="text-[10px] text-white/40">@{m.ofUsername}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

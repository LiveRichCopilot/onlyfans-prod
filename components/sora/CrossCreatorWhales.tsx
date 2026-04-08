"use client";

import { useEffect, useState } from "react";

export type Whale = {
  ofapiFanId: string;
  username: string | null;
  totalSpend: number;
  thisModelSpend: number;
  otherSpend: number;
  creatorCount: number;
  creators: Array<{ name: string; spend: number; isThisModel: boolean }>;
  status: "hidden_whale" | "engaged_whale" | "low_engagement";
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: Whale["status"] }) {
  if (status === "hidden_whale") {
    return (
      <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-[10px] font-bold uppercase tracking-widest border border-yellow-500/40">
        Hidden whale
      </span>
    );
  }
  if (status === "low_engagement") {
    return (
      <span className="px-2 py-1 rounded-lg bg-orange-500/20 text-orange-300 text-[10px] font-bold uppercase tracking-widest border border-orange-500/40">
        Spends elsewhere
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-lg bg-teal-500/20 text-teal-300 text-[10px] font-bold uppercase tracking-widest border border-teal-500/40">
      Engaged whale
    </span>
  );
}

export function CrossCreatorWhales({ modelId }: { modelId: string | null }) {
  const [whales, setWhales] = useState<Whale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/sora/whales?modelId=${encodeURIComponent(modelId)}&minSpend=200&limit=15`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setWhales(json.whales || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  if (loading) {
    return (
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Cross-Creator Whales
        </div>
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">Searching the agency for whales…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Cross-Creator Whales
        </div>
        <div className="glass-panel rounded-2xl p-6 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (whales.length === 0) {
    return (
      <div>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
          Cross-Creator Whales
        </div>
        <div className="glass-panel rounded-2xl p-6 text-white/50 text-sm">
          No cross-creator whales found yet for this model. As more buyers transact across creators they'll show up here.
        </div>
      </div>
    );
  }

  const hiddenCount = whales.filter((w) => w.status === "hidden_whale").length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          Cross-Creator Whales
        </div>
        {hiddenCount > 0 && (
          <div className="text-[10px] text-yellow-300 font-semibold uppercase tracking-widest">
            {hiddenCount} hidden whale{hiddenCount === 1 ? "" : "s"} found
          </div>
        )}
      </div>
      <div className="space-y-3">
        {whales.map((w) => (
          <div
            key={w.ofapiFanId}
            className={
              "glass-panel rounded-2xl p-5 border " +
              (w.status === "hidden_whale"
                ? "border-yellow-500/40 bg-yellow-500/5"
                : "border-white/10")
            }
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <div className="text-base font-bold text-white truncate">
                    @{w.username || `u${w.ofapiFanId}`}
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                <div className="text-[11px] text-white/40">
                  Buys from {w.creatorCount} creator{w.creatorCount === 1 ? "" : "s"} in the agency
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{fmtMoney(w.totalSpend)}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest">total spent</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-white/40 uppercase tracking-widest text-[9px]">On this model</div>
                <div
                  className={
                    "text-base font-bold " +
                    (w.thisModelSpend > 0 ? "text-teal-300" : "text-white/40")
                  }
                >
                  {fmtMoney(w.thisModelSpend)}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-white/40 uppercase tracking-widest text-[9px]">On others</div>
                <div className="text-base font-bold text-yellow-300">{fmtMoney(w.otherSpend)}</div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="text-[9px] text-white/40 uppercase tracking-widest font-semibold mb-2">
                Spent across
              </div>
              <div className="flex flex-wrap gap-2">
                {w.creators.map((c, i) => (
                  <div
                    key={i}
                    className={
                      "px-2 py-1 rounded-lg text-[11px] " +
                      (c.isThisModel
                        ? "bg-teal-500/20 text-teal-200 border border-teal-500/40"
                        : "bg-white/5 text-white/70 border border-white/10")
                    }
                  >
                    {c.name.length > 24 ? c.name.slice(0, 24) + "…" : c.name} · {fmtMoney(c.spend)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-white/40 mt-2">
        Whales sorted with hidden whales first (high spend on other creators, $0 on this model — recovery opportunity).
      </div>
    </div>
  );
}

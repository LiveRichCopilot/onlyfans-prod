"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Eye, ShoppingCart, DollarSign, MessageSquare } from "lucide-react";

type HookEntry = { name: string; count: number; viewedCount: number; purchasedCount: number; conversionRate: number; totalRevenue: number; avgPrice: number };
type TopDirect = { hookText: string; hookCategory: string; contentType: string; price: number; purchasedCount: number; viewedCount: number; conversionRate: number; revenue: number; creatorName: string; date: string };
type TopMass = TopDirect & { sentCount: number; openRate: number };

type ContentData = {
  kpis: { totalMessages: number; totalDirect: number; totalMass: number; totalViewed: number; totalPurchased: number; totalRevenue: number; avgConversionRate: number; bestHook: string };
  hookPerformance: HookEntry[];
  contentTypePerformance: HookEntry[];
  priceBucketPerformance: HookEntry[];
  creatorPerformance: HookEntry[];
  topPerformingDirect: TopDirect[];
  topPerformingMass: TopMass[];
};

const TABS = ["Hooks", "Content Type", "Price", "By Creator", "Top Messages"] as const;
type Tab = (typeof TABS)[number];

const HOOK_COLORS: Record<string, string> = {
  question: "#60a5fa",
  teaser: "#a78bfa",
  personal: "#f472b6",
  urgency: "#f87171",
  direct_offer: "#34d399",
  casual: "rgba(255,255,255,0.3)",
  game: "#fbbf24",
  flirty: "#fb7185",
  other: "rgba(255,255,255,0.15)",
};

function getBarColor(name: string): string {
  return HOOK_COLORS[name] || "#5eead4";
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function BarRow({ entry, maxConversion }: { entry: HookEntry; maxConversion: number }) {
  const barWidth = maxConversion > 0 ? Math.max((entry.conversionRate / maxConversion) * 100, 2) : 2;
  const color = getBarColor(entry.name);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-white/70 text-xs w-24 shrink-0 truncate capitalize">{entry.name.replace("_", " ")}</span>
      <div className="flex-1 h-6 glass-inset rounded-lg overflow-hidden relative">
        <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${barWidth}%`, background: color }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/60 font-medium tabular-nums">
          {entry.conversionRate}%
        </span>
      </div>
      <span className="text-white/40 text-[10px] w-14 text-right tabular-nums">{entry.count} msgs</span>
      <span className="text-teal-400/80 text-[10px] w-16 text-right tabular-nums font-medium">${entry.totalRevenue.toFixed(0)}</span>
    </div>
  );
}

function BarChart({ data }: { data: HookEntry[] }) {
  if (data.length === 0) return <EmptyState />;
  const maxConversion = Math.max(...data.map((d) => d.conversionRate), 1);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3 pb-1 border-b border-white/5 mb-1">
        <span className="text-white/30 text-[10px] w-24 shrink-0">Category</span>
        <span className="text-white/30 text-[10px] flex-1">Conversion Rate</span>
        <span className="text-white/30 text-[10px] w-14 text-right">Count</span>
        <span className="text-white/30 text-[10px] w-16 text-right">Revenue</span>
      </div>
      {data.map((entry) => (
        <BarRow key={entry.name} entry={entry} maxConversion={maxConversion} />
      ))}
    </div>
  );
}

function CategoryPill({ label, color }: { label: string; color?: string }) {
  const bg = color || getBarColor(label);
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border" style={{ color: bg, borderColor: bg, background: `${bg}15` }}>
      {label.replace("_", " ")}
    </span>
  );
}

function TopMessageRow({ msg }: { msg: TopDirect | TopMass }) {
  return (
    <div className="glass-inset rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white/70 text-xs leading-relaxed italic flex-1">&ldquo;{truncate(msg.hookText, 60)}&rdquo;</p>
        <span className="text-white/30 text-[10px] shrink-0">{msg.creatorName}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <CategoryPill label={msg.hookCategory} />
        <CategoryPill label={msg.contentType} color="#5eead4" />
        {msg.price > 0 && <span className="text-white/40 text-[10px]">${msg.price}</span>}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-white/40">
        {"sentCount" in msg && (msg as TopMass).sentCount > 0 && (
          <span>Sent: <span className="text-white/60 font-medium">{(msg as TopMass).sentCount}</span></span>
        )}
        <span className="flex items-center gap-1"><Eye size={10} /> <span className="text-white/60 font-medium">{msg.viewedCount}</span></span>
        <span className="flex items-center gap-1"><ShoppingCart size={10} /> <span className="text-white/60 font-medium">{msg.purchasedCount}</span></span>
        <span className="flex items-center gap-1"><DollarSign size={10} /> <span className="text-teal-400/80 font-medium">${msg.revenue.toFixed(0)}</span></span>
        <span className="ml-auto text-white/50 font-semibold">{msg.conversionRate}% CVR</span>
        {"openRate" in msg && (msg as TopMass).openRate > 0 && (
          <span className="text-white/40">{(msg as TopMass).openRate}% open</span>
        )}
      </div>
    </div>
  );
}

function TopMessagesTab({ direct, mass }: { direct: TopDirect[]; mass: TopMass[] }) {
  if (direct.length === 0 && mass.length === 0) return <EmptyState />;
  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
      {direct.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">Direct Messages</p>
          <div className="space-y-2">{direct.map((m, i) => <TopMessageRow key={`d-${i}`} msg={m} />)}</div>
        </div>
      )}
      {mass.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">Mass Messages</p>
          <div className="space-y-2">{mass.map((m, i) => <TopMessageRow key={`m-${i}`} msg={m} />)}</div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[160px] flex items-center justify-center text-white/30 text-sm">
      <MessageSquare size={14} className="mr-2 opacity-50" /> No engagement data available
    </div>
  );
}

export function ContentPerformancePanel({ days, creatorFilter }: { days: number; creatorFilter: string }) {
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Hooks");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (creatorFilter && creatorFilter !== "all") params.set("creatorId", creatorFilter);
      const res = await fetch(`/api/team-analytics/content-performance?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `HTTP ${res.status}`);
        setData(null);
      } else {
        setData(await res.json());
      }
    } catch {
      setError("Failed to fetch content performance data");
    }
    setLoading(false);
  }, [days, creatorFilter]);

  useEffect(() => { load(); }, [load]);

  const k = data?.kpis;

  return (
    <div className="glass-card rounded-3xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-teal-400" /> Content Performance
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Which messages, hooks, and content types actually get fans to respond and buy
          </p>
        </div>
        <button onClick={load} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Loading / Error / Empty */}
      {loading && !data && (
        <div className="h-[200px] flex items-center justify-center">
          <RefreshCw size={18} className="text-teal-400 animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="h-[160px] flex items-center justify-center text-white/30 text-sm">
          {error === "No creators with OFAPI access" ? "No creators with OFAPI tokens configured" : error}
        </div>
      )}

      {data && k && (
        <>
          {/* KPI pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <KpiPill label="Total Messages" value={String(k.totalMessages)} sub={`${k.totalDirect} direct / ${k.totalMass} mass`} />
            <KpiPill label="Viewed" value={k.totalViewed.toLocaleString()} />
            <KpiPill label="Purchased" value={k.totalPurchased.toLocaleString()} sub={`${k.avgConversionRate}% CVR`} />
            <KpiPill label="Best Hook" value={k.bestHook.replace("_", " ")} sub={`$${k.totalRevenue.toFixed(0)} revenue`} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${tab === t ? "glass-prominent text-white" : "glass-button text-white/40"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "Hooks" && <BarChart data={data.hookPerformance} />}
          {tab === "Content Type" && <BarChart data={data.contentTypePerformance} />}
          {tab === "Price" && <BarChart data={data.priceBucketPerformance} />}
          {tab === "By Creator" && <BarChart data={data.creatorPerformance} />}
          {tab === "Top Messages" && <TopMessagesTab direct={data.topPerformingDirect} mass={data.topPerformingMass} />}
        </>
      )}
    </div>
  );
}

function KpiPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-inset rounded-2xl px-4 py-3">
      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold text-lg mt-0.5 capitalize">{value}</p>
      {sub && <p className="text-white/40 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

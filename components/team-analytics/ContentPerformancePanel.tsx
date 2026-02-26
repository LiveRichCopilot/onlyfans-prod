"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Download } from "lucide-react";
import { DateRangePicker, type DateRange } from "./DateRangePicker";
import { ContentMessageCard, ContentEmptyState } from "./ContentMessageCard";
import { ContentCreatorTab } from "./ContentCreatorTab";
import { MassMessageImpactChart } from "./MassMessageImpactChart";
import type { MessageCardData, ReplyStats } from "./ContentMessageCard";

type AggEntry = {
  name: string; count: number; sentCount: number; viewedCount: number;
  purchasedCount: number; conversionRate: number; viewRate: number;
  purchaseRate: number; totalRevenue: number; avgPrice: number;
  rpm: number; ctaRate: number;
};

type ContentData = {
  dateRange: { start: string; end: string; days: number };
  kpis: {
    totalMessages: number; totalDirect: number; totalMass: number; totalSent: number;
    totalViewed: number; totalPurchased: number; totalRevenue: number;
    avgConversionRate: number; bestHook: string; ctaCount: number; ctaRate: number; rpm: number;
  };
  hookPerformance: AggEntry[];
  contentTypePerformance: AggEntry[];
  priceBucketPerformance: AggEntry[];
  creatorPerformance: AggEntry[];
  topDirect: MessageCardData[];
  topMass: MessageCardData[];
  noBitesDirect: MessageCardData[];
  noBitesMass: MessageCardData[];
  allDirect: MessageCardData[];
  allMass: MessageCardData[];
};

const TABS = ["Direct Messages", "Mass Messages", "Hooks", "By Creator", "No Bites"] as const;
type Tab = (typeof TABS)[number];

const HOOK_COLORS: Record<string, string> = {
  question: "#60a5fa", teaser: "#a78bfa", personal: "#f472b6",
  urgency: "#f87171", direct_offer: "#34d399", casual: "rgba(255,255,255,0.3)",
  game: "#fbbf24", flirty: "#fb7185", other: "rgba(255,255,255,0.15)",
};

function getBarColor(name: string): string { return HOOK_COLORS[name] || "#5eead4"; }

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function AggRow({ e, maxVal, metric }: { e: AggEntry; maxVal: number; metric: "revenue" | "cvr" | "rpm" }) {
  const val = metric === "revenue" ? e.totalRevenue : metric === "rpm" ? e.rpm : e.conversionRate;
  const barWidth = maxVal > 0 ? Math.max((val / maxVal) * 100, 2) : 2;
  const color = getBarColor(e.name);
  return (
    <div className="py-2 space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-white/70 text-xs w-28 shrink-0 truncate capitalize">{e.name.replace(/_/g, " ")}</span>
        <div className="flex-1 h-6 glass-inset rounded-lg overflow-hidden relative">
          <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${barWidth}%`, background: color }} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/60 font-medium tabular-nums">
            {metric === "revenue" ? `$${val.toFixed(0)}` : metric === "rpm" ? `$${val.toFixed(2)} RPM` : `${val}% CVR`}
          </span>
        </div>
      </div>
      {/* Raw numbers under the bar */}
      <div className="flex items-center gap-3 pl-[7.5rem] text-[9px] text-white/25 tabular-nums">
        <span>{e.count} msgs</span>
        {e.sentCount > 0 && <span>Sent: {fmtNum(e.sentCount)}</span>}
        <span>Viewed: {fmtNum(e.viewedCount)} {e.viewRate > 0 && `(${e.viewRate}%)`}</span>
        <span>Bought: {fmtNum(e.purchasedCount)} {e.conversionRate > 0 && `(${e.conversionRate}% CVR)`}</span>
        <span className="text-teal-400/50 font-medium">${e.totalRevenue.toFixed(0)}</span>
      </div>
    </div>
  );
}

function AggTable({ data, metric }: { data: AggEntry[]; metric: "revenue" | "cvr" | "rpm" }) {
  if (data.length === 0) return <ContentEmptyState />;
  const vals = data.map(d => metric === "revenue" ? d.totalRevenue : metric === "rpm" ? d.rpm : d.conversionRate);
  const maxVal = Math.max(...vals, 1);
  return (
    <div className="space-y-0">
      {data.map(e => <AggRow key={e.name} e={e} maxVal={maxVal} metric={metric} />)}
    </div>
  );
}

function MessageList({ messages, emptyMsg, replyMap }: { messages: MessageCardData[]; emptyMsg?: string; replyMap?: Map<string, ReplyStats> }) {
  if (messages.length === 0) return <ContentEmptyState message={emptyMsg} />;
  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
      {messages.map((m, i) => <ContentMessageCard key={m.id} msg={m} rank={i + 1} replyStats={replyMap?.get(m.id)} />)}
    </div>
  );
}

/** Export current tab's messages as CSV */
function exportCSV(messages: MessageCardData[], filename: string) {
  const headers = ["Creator", "Date", "Hook", "Content Type", "Media Type", "PPV", "Price", "Sent", "Viewed", "View Rate%", "Purchased", "CVR%", "Revenue", "CTA", "Full Text", "Thumbnail URL"];
  const rows = messages.map(m => {
    const cvr = m.viewedCount > 0 ? ((m.purchasedCount / m.viewedCount) * 100).toFixed(2) : "0";
    const vr = m.sentCount > 0 ? ((m.viewedCount / m.sentCount) * 100).toFixed(2) : "";
    const thumb = m.thumbnails?.[0]?.url || "";
    const text = m.rawText.replace(/"/g, '""');
    return [m.creatorName, m.date, m.hookCategory, m.contentType, m.mediaType, m.isPPV ? "Yes" : "No", m.price, m.sentCount, m.viewedCount, vr, m.purchasedCount, cvr, (m.purchasedCount * m.price).toFixed(2), m.hasCTA ? "Yes" : "No", `"${text}"`, thumb].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export function ContentPerformancePanel({ days, creatorFilter, startDate, endDate, dateLabel, onDateChange }: { days: number; creatorFilter: string; startDate?: string; endDate?: string; dateLabel?: string; onDateChange?: (range: DateRange) => void }) {
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Direct Messages");
  const [hookMetric, setHookMetric] = useState<"revenue" | "cvr" | "rpm">("revenue");
  const [replyMap, setReplyMap] = useState<Map<string, ReplyStats>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      } else {
        params.set("days", String(days));
      }
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
  }, [days, creatorFilter, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  // Fetch reply attribution data (separate lightweight call)
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams({ days: String(days) });
    if (startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    if (creatorFilter && creatorFilter !== "all") params.set("creatorId", creatorFilter);
    fetch(`/api/team-analytics/mass-reply-stats?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.stats) return;
        const map = new Map<string, ReplyStats>();
        for (const s of json.stats) {
          map.set(s.massMessageId, { uniqueRepliers: s.uniqueRepliers, inboundMessages: s.inboundMessages });
        }
        setReplyMap(map);
      })
      .catch(() => {});
  }, [data, days, creatorFilter]);

  const k = data?.kpis;
  const dr = data?.dateRange;

  // Get exportable messages for current tab
  const getExportMessages = (): { messages: MessageCardData[]; name: string } | null => {
    if (!data) return null;
    if (tab === "Direct Messages") return { messages: data.allDirect || data.topDirect, name: "direct-messages" };
    if (tab === "Mass Messages") return { messages: data.allMass || data.topMass, name: "mass-messages" };
    if (tab === "No Bites") return { messages: [...(data.noBitesDirect || []), ...(data.noBitesMass || [])], name: "no-bites" };
    if (tab === "By Creator") return { messages: [...(data.allDirect || []), ...(data.allMass || [])], name: "all-by-creator" };
    return null;
  };

  return (
    <div className="glass-card rounded-3xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-teal-400" /> Content Performance
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Based on messages sent in this range
            {dr && <span className="text-white/25 ml-1">{dr.start} to {dr.end} ({dr.days}d)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onDateChange && (
            <DateRangePicker
              value={{ startDate: startDate || "", endDate: endDate || "", label: dateLabel || (dr ? `${dr.days}d` : `${days}d`), days }}
              onChange={onDateChange}
            />
          )}
          {data && getExportMessages() && (
            <button
              onClick={() => { const e = getExportMessages(); if (e) exportCSV(e.messages, e.name); }}
              className="glass-button rounded-xl px-3 py-2 text-white/40 hover:text-white flex items-center gap-1.5 text-[10px] font-medium"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
          <button onClick={load} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <KpiPill label="Unique Messages" value={String(k.totalMessages)} sub={`${k.totalDirect} DM / ${k.totalMass} mass`} />
            <KpiPill label="Total Recipients" value={fmtNum(k.totalSent)} sub="fans messages reached" />
            <KpiPill label="Viewed" value={fmtNum(k.totalViewed)} sub={k.totalSent > 0 ? `${(k.totalViewed / k.totalSent * 100).toFixed(1)}% view rate` : undefined} />
            <KpiPill label="Purchased" value={k.totalPurchased.toLocaleString()} sub={`${k.avgConversionRate}% of viewers bought`} />
            <KpiPill label="Revenue" value={`$${k.totalRevenue.toFixed(0)}`} sub={k.rpm > 0 ? `$${k.rpm.toFixed(2)} per 1K sent` : undefined} accent />
            <KpiPill label="CTA Usage" value={`${k.ctaRate}%`} sub={`${k.ctaCount} msgs with CTA`} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 ${tab === t ? "glass-prominent text-white" : "glass-button text-white/40"}`}>
                {t === "No Bites" && <TrendingDown size={12} />}
                {(t === "Direct Messages" || t === "Mass Messages") && <TrendingUp size={12} />}
                {t}
                {t === "Direct Messages" && <span className="text-white/20 text-[10px]">({k.totalDirect})</span>}
                {t === "Mass Messages" && <span className="text-white/20 text-[10px]">({k.totalMass})</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "Direct Messages" && (
            <MessageList messages={data.topDirect} emptyMsg="No direct messages with purchases in this period" />
          )}

          {tab === "Mass Messages" && (
            <div className="space-y-4">
              <MassMessageImpactChart days={days} creatorFilter={creatorFilter} startDate={startDate} endDate={endDate} />
              <div className="border-t border-white/5 pt-3">
                <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">Top Performing Mass Messages</p>
                <MessageList messages={data.topMass} emptyMsg="No mass messages in this period" replyMap={replyMap} />
              </div>
            </div>
          )}

          {tab === "Hooks" && (
            <div className="space-y-3">
              <div className="flex gap-1">
                {(["revenue", "cvr", "rpm"] as const).map(m => (
                  <button key={m} onClick={() => setHookMetric(m)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition ${hookMetric === m ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"}`}>
                    {m === "revenue" ? "By Revenue" : m === "cvr" ? "By CVR (bought/viewed)" : "By RPM ($/1K sent)"}
                  </button>
                ))}
              </div>
              <AggTable data={data.hookPerformance} metric={hookMetric} />
              <div className="border-t border-white/5 pt-3 mt-3">
                <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">By Content Type</p>
                <AggTable data={data.contentTypePerformance} metric={hookMetric} />
              </div>
              <div className="border-t border-white/5 pt-3 mt-3">
                <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider mb-2">By Price Bucket</p>
                <AggTable data={data.priceBucketPerformance} metric={hookMetric} />
              </div>
            </div>
          )}

          {tab === "By Creator" && (
            <ContentCreatorTab
              creatorPerformance={data.creatorPerformance}
              allDirect={data.allDirect || []}
              allMass={data.allMass || []}
            />
          )}

          {tab === "No Bites" && (
            <div className="space-y-4">
              <p className="text-white/40 text-xs">
                PPV messages that fans viewed but nobody bought. What&apos;s NOT working.
              </p>
              {data.noBitesDirect.length > 0 && (
                <div>
                  <p className="text-[10px] text-red-400/60 font-semibold uppercase tracking-wider mb-2">Direct Messages — Zero Purchases</p>
                  <MessageList messages={data.noBitesDirect} emptyMsg="No failed direct PPV messages" />
                </div>
              )}
              {data.noBitesMass.length > 0 && (
                <div>
                  <p className="text-[10px] text-red-400/60 font-semibold uppercase tracking-wider mb-2">Mass Messages — Zero Purchases</p>
                  <MessageList messages={data.noBitesMass} emptyMsg="No failed mass PPV messages" />
                </div>
              )}
              {data.noBitesDirect.length === 0 && data.noBitesMass.length === 0 && (
                <ContentEmptyState message="No failed PPV messages found (good!)" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiPill({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="glass-inset rounded-2xl px-4 py-3">
      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`font-bold text-lg mt-0.5 ${accent ? "text-teal-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-white/40 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

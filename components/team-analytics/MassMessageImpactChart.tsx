"use client";

import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart, Legend } from "recharts";
import { TrendingUp, RefreshCw } from "lucide-react";

type DailyPoint = { date: string; sent: number; purchased: number; revenue: number };

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-3 py-2 text-xs border border-white/10">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white/80" style={{ color: p.color }}>
          {p.name}: {p.name === "Revenue" ? `$${Number(p.value).toFixed(0)}` : fmtNum(p.value)}
        </p>
      ))}
    </div>
  );
}

export function MassMessageImpactChart({ days, creatorFilter }: { days: number; creatorFilter: string }) {
  const [data, setData] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (creatorFilter && creatorFilter !== "all") params.set("creatorId", creatorFilter);
      const res = await fetch(`/api/team-analytics/mass-message-chart?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.daily || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [days, creatorFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <RefreshCw size={14} className="text-teal-400 animate-spin" />
      </div>
    );
  }

  if (data.length === 0) return null;

  // Compute lift stats
  const sendDays = data.filter(d => d.sent > 0);
  const noSendDays = data.filter(d => d.sent === 0);
  const avgSendDayRevenue = sendDays.length > 0 ? sendDays.reduce((s, d) => s + d.revenue, 0) / sendDays.length : 0;
  const avgNoSendRevenue = noSendDays.length > 0 ? noSendDays.reduce((s, d) => s + d.revenue, 0) / noSendDays.length : 0;
  const avgSendDayPurchases = sendDays.length > 0 ? sendDays.reduce((s, d) => s + d.purchased, 0) / sendDays.length : 0;

  // Format dates for chart
  const chartData = data.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp size={10} /> Mass Message Send Volume vs Purchases
        </p>
        <button onClick={load} className="text-white/20 hover:text-white/50">
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Lift stats */}
      <div className="flex gap-3 text-[10px]">
        {sendDays.length > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">Send days avg:</span>{" "}
            <span className="text-teal-400 font-semibold">${avgSendDayRevenue.toFixed(0)}</span>{" "}
            <span className="text-white/20">({sendDays.length}d)</span>
          </div>
        )}
        {noSendDays.length > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">No-send days avg:</span>{" "}
            <span className="text-white/50 font-semibold">${avgNoSendRevenue.toFixed(0)}</span>{" "}
            <span className="text-white/20">({noSendDays.length}d)</span>
          </div>
        )}
        {avgSendDayRevenue > 0 && avgNoSendRevenue > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">Lift:</span>{" "}
            <span className={`font-semibold ${avgSendDayRevenue > avgNoSendRevenue ? "text-teal-400" : "text-red-400"}`}>
              {avgSendDayRevenue > avgNoSendRevenue ? "+" : ""}{((avgSendDayRevenue / avgNoSendRevenue - 1) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="sent" orientation="left" tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
            <YAxis yAxisId="rev" orientation="right" tick={{ fill: "rgba(94,234,212,0.3)", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmtNum(v)}`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, opacity: 0.4 }} />
            <Bar yAxisId="sent" dataKey="sent" name="Sent" fill="rgba(255,255,255,0.08)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="sent" dataKey="purchased" name="Purchased" fill="rgba(94,234,212,0.3)" radius={[4, 4, 0, 0]} />
            <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#5eead4" fill="rgba(94,234,212,0.08)" strokeWidth={1.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[9px] text-white/15 text-center">
        Purchase data only. Inbound fan reply tracking requires chat message pipeline (planned).
      </p>
    </div>
  );
}

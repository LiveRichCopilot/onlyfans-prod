"use client";

import { useState, useEffect, useCallback } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart, Legend } from "recharts";
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
    <div className="rounded-xl px-3 py-2 text-xs border border-white/10 shadow-xl" style={{ background: "#1a1a2e", backdropFilter: "none" }}>
      <p className="text-white/70 font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color || "#fff" }}>
          {p.name}: {p.name === "Revenue" ? `$${Number(p.value).toFixed(0)}` : fmtNum(p.value)}
        </p>
      ))}
    </div>
  );
}

export function MassMessageImpactChart({ days, creatorFilter, startDate, endDate }: { days: number; creatorFilter: string; startDate?: string; endDate?: string }) {
  const [data, setData] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      } else {
        params.set("days", String(days));
      }
      if (creatorFilter && creatorFilter !== "all") params.set("creatorId", creatorFilter);
      const res = await fetch(`/api/team-analytics/mass-message-chart?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.daily || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [days, creatorFilter, startDate, endDate]);

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
      <div className="flex gap-3 text-[10px] flex-wrap">
        {sendDays.length > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">Send days avg:</span>{" "}
            <span className="text-teal-400 font-semibold">
              {avgSendDayRevenue > 0 ? `$${avgSendDayRevenue.toFixed(0)}` : `${avgSendDayPurchases.toFixed(0)} purchases`}
            </span>{" "}
            <span className="text-white/20">({sendDays.length}d)</span>
          </div>
        )}
        {noSendDays.length > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">No-send days avg:</span>{" "}
            <span className="text-white/50 font-semibold">
              {avgNoSendRevenue > 0 ? `$${avgNoSendRevenue.toFixed(0)}` : `${noSendDays.length > 0 ? (noSendDays.reduce((s, d) => s + d.purchased, 0) / noSendDays.length).toFixed(0) : 0} purchases`}
            </span>{" "}
            <span className="text-white/20">({noSendDays.length}d)</span>
          </div>
        )}
        {avgSendDayPurchases > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">Total sent:</span>{" "}
            <span className="text-white/60 font-semibold">{fmtNum(sendDays.reduce((s, d) => s + d.sent, 0))}</span>
            <span className="text-white/20 ml-1">msgs</span>
          </div>
        )}
        {avgSendDayPurchases > 0 && (
          <div className="glass-inset rounded-lg px-3 py-1.5">
            <span className="text-white/30">Total purchased:</span>{" "}
            <span className="text-teal-400/80 font-semibold">{fmtNum(data.reduce((s, d) => s + d.purchased, 0))}</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="sent" orientation="left" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend wrapperStyle={{ fontSize: 10, opacity: 0.5 }} />
            <Bar yAxisId="sent" dataKey="sent" name="Sent" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="sent" dataKey="purchased" name="Purchased" fill="rgba(94,234,212,0.5)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[9px] text-white/15 text-center">
        Sent volume vs purchase count per day. Reply attribution shown on individual messages below.
      </p>
    </div>
  );
}

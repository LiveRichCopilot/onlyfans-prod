"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Users, Activity, Clock, TrendingUp } from "lucide-react";

type ChatterStats = {
  hubstaffUserId: number;
  name: string;
  email: string;
  chatterEmail: string;
  isOnline: boolean;
  lastActivityAt: string | null;
  today: {
    trackedFormatted: string;
    activityPercent: number;
  };
  assignedModels: { creatorName: string | null }[];
  scoring: { avgScore: number | null };
};

type StatsData = {
  date: string;
  totalMembers: number;
  onlineNow: number;
  chatters: ChatterStats[];
};

export function HubstaffStatsSection() {
  const { t } = useLanguage();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/team/hubstaff?date=${date}&days=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-8 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-amber-500/20">
        <p className="text-sm text-amber-400/90">{error}</p>
      </div>
    );
  }

  if (!data || data.chatters.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <p className="text-sm text-white/40">{t("hubstaffChattersToday")}: no data</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-white/10">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-teal-400" />
            <span className="font-semibold text-white/90">{t("hubstaffChattersToday")}</span>
          </div>
          <span className="text-xs text-white/40">
            {data.date} · {data.onlineNow}/{data.totalMembers} {t("hubstaffOnlineNow")}
          </span>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
        />
      </div>
      <div className="divide-y divide-white/[0.04]">
        {data.chatters.slice(0, 12).map((c) => (
          <div
            key={c.hubstaffUserId}
            className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  c.isOnline ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-white/20"
                }`}
              />
              <span className="text-sm font-medium text-white/90 truncate">{c.name || c.chatterEmail}</span>
              {c.assignedModels.length > 0 && (
                <span className="text-[10px] text-teal-400/80 truncate max-w-[120px]">
                  → {c.assignedModels.map((m) => m.creatorName).filter(Boolean).join(", ") || "—"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 shrink-0 text-xs">
              <span className="flex items-center gap-1 text-white/50" title={t("hubstaffTrackedTime")}>
                <Clock size={12} />
                {c.today.trackedFormatted || "—"}
              </span>
              <span className="flex items-center gap-1 text-white/50" title={t("hubstaffActivity")}>
                <Activity size={12} />
                {c.today.activityPercent}%
              </span>
              {c.scoring.avgScore != null && (
                <span className="flex items-center gap-1 text-teal-400/90" title={t("hubstaffScore")}>
                  <TrendingUp size={12} />
                  {c.scoring.avgScore}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

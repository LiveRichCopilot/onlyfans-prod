"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, BarChart2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { KpiStatsRow } from "@/components/team-analytics/KpiStatsRow";
import { PerformanceTrendChart } from "@/components/team-analytics/PerformanceTrendChart";
import { ArchetypePieChart } from "@/components/team-analytics/ArchetypePieChart";
import { CreatorWorkloadPie } from "@/components/team-analytics/CreatorWorkloadPie";
import { ChatterComparisonBar } from "@/components/team-analytics/ChatterComparisonBar";
import { ScoreCategoryBars } from "@/components/team-analytics/ScoreCategoryBars";
import { ChatterRadarChart } from "@/components/team-analytics/ChatterRadarChart";
import { HoursStackedArea } from "@/components/team-analytics/HoursStackedArea";
import { ActivityByHourBar } from "@/components/team-analytics/ActivityByHourBar";
import { TagCloudPanel } from "@/components/team-analytics/TagCloudPanel";
import { TeamGaugePanel } from "@/components/team-analytics/TeamGaugePanel";
import { ConversationPhoneGallery } from "@/components/team-analytics/ConversationPhoneGallery";
import { CopyPasteBlasting } from "@/components/team-analytics/CopyPasteBlasting";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function TeamAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (creatorFilter !== "all") params.set("creatorId", creatorFilter);
      const res = await fetch(`/api/team-analytics?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        // Build creator list from unfiltered allCreators (always complete)
        if (json.allCreators?.length) {
          setCreators(json.allCreators.map((c: any) => ({ id: c.creatorId, name: c.creatorName })));
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [days, creatorFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-teal-400 animate-spin" />
      </div>
    );
  }

  const d = data || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart2 size={22} className="text-teal-400" /> Team Analytics
            </h1>
            <p className="text-white/40 text-sm">Chatter performance dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Creator Filter */}
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="glass-button rounded-xl px-3 py-1.5 text-xs font-medium text-white/70 bg-transparent border border-white/10 appearance-none cursor-pointer max-w-[180px] truncate"
          >
            <option value="all" className="bg-[#111]">All Creators</option>
            {creators.map(c => (
              <option key={c.id} value={c.id} className="bg-[#111]">{c.name}</option>
            ))}
          </select>
          {/* Time Range */}
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setDays(r.days)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${days === r.days ? "glass-prominent text-white" : "glass-button text-white/50"}`}>
              {r.label}
            </button>
          ))}
          <button onClick={load} className="glass-button rounded-xl p-2 text-white/40 hover:text-white ml-2">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* KPI Stats */}
      <KpiStatsRow data={d.kpis || { activeChatters: 0, totalSessions: 0, avgTeamScore: 0, totalHoursWorked: 0, scoringSessionsCount: 0, liveNow: 0 }} />

      {/* Row 1: Performance Trend (full width) */}
      <PerformanceTrendChart data={d.performanceTrend || []} />

      {/* Row 2: Gauges + Category Bars + Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TeamGaugePanel avgScore={d.kpis?.avgTeamScore || 0} categoryAverages={d.categoryAverages || { sla: 0, followup: 0, trigger: 0, quality: 0, revenue: 0 }} />
        <ScoreCategoryBars data={d.categoryAverages || { sla: 0, followup: 0, trigger: 0, quality: 0, revenue: 0 }} />
        <ChatterRadarChart data={d.chatterRadar || []} />
      </div>

      {/* Row 3: Pie Charts + Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ArchetypePieChart data={d.archetypeDistribution || []} />
        <CreatorWorkloadPie data={d.creatorWorkload || []} />
        <ActivityByHourBar data={d.activityByHour || []} />
      </div>

      {/* Row 4: Chatter Rankings (full width) */}
      <ChatterComparisonBar data={d.chatterComparison || []} />

      {/* Row 5: Hours + Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HoursStackedArea data={d.hoursOverTime || []} />
        <TagCloudPanel data={d.tagCloud || { strengths: [], weaknesses: [] }} />
      </div>

      {/* Row 6: Copy-Paste Blasting (full width) */}
      <CopyPasteBlasting data={d.copyPasteBlasters || []} />

      {/* Row 7: Conversation Scoring with Chat Bubbles (full width) */}
      <ConversationPhoneGallery data={d.conversationSamples || []} />
    </div>
  );
}

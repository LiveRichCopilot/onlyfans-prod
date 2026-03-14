"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, BarChart2, ArrowLeft, HelpCircle, ChevronDown, Search, X } from "lucide-react";
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
import { ContentPerformancePanel } from "@/components/team-analytics/ContentPerformancePanel";
import { LiveActivityPanel } from "@/components/team-analytics/LiveActivityPanel";
import { TimelinePanel } from "@/components/team-analytics/TimelinePanel";
import { ShiftReportPanel } from "@/components/team-analytics/ShiftReportPanel";
import { ChatterPerformanceTable } from "@/components/team-analytics/ChatterPerformanceTable";
import { WiringPanel } from "@/components/team-analytics/WiringPanel";
import { TeamReportsPanel } from "@/components/team-analytics/TeamReportsPanel";
import { DateRangePicker, type DateRange } from "@/components/team-analytics/DateRangePicker";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [shiftReportTarget, setShiftReportTarget] = useState<{ email: string; creatorId?: string } | null>(null);
  const [contentDateRange, setContentDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    label: "7d",
    days: 7,
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return creators.filter((c) =>
      c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [searchQuery, creators]);

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
    <div className="max-w-7xl mx-auto space-y-6" onClick={() => searchOpen && setSearchOpen(false)}>
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
        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {/* Model Search */}
          <div className="relative min-w-[160px]">
            <div className="glass-button rounded-xl flex items-center gap-2 px-3 h-9 border border-white/10">
              <Search size={14} className="text-white/40 shrink-0" />
              <input
                type="text"
                placeholder="Search model..."
                value={creatorFilter !== "all" ? (creators.find((c) => c.id === creatorFilter)?.name || searchQuery) : searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); if (creatorFilter !== "all") setCreatorFilter("all"); }}
                onFocus={() => setSearchOpen(true)}
                className="bg-transparent text-xs text-white border-none outline-none w-full placeholder:text-white/30"
              />
              {(creatorFilter !== "all" || searchQuery) && (
                <button onClick={() => { setCreatorFilter("all"); setSearchQuery(""); setSearchOpen(false); }} className="text-white/40 hover:text-white/70">
                  <X size={14} />
                </button>
              )}
            </div>
            {searchOpen && searchQuery.trim() && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 glass-card rounded-xl border border-white/10 max-h-60 overflow-y-auto z-50">
                {searchResults.map((c) => (
                  <button key={c.id} onClick={() => { setCreatorFilter(c.id); setSearchQuery(""); setSearchOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 border-b border-white/5 last:border-0">
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Time Range */}
          {RANGES.map(r => (
            <button key={r.days} onClick={() => {
              setDays(r.days);
              setContentDateRange({
                startDate: new Date(Date.now() - r.days * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString(),
                label: r.label,
                days: r.days,
              });
            }} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${days === r.days ? "glass-prominent text-white" : "glass-button text-white/50"}`}>
              {r.label}
            </button>
          ))}
          <button onClick={load} className="glass-button rounded-xl p-2 text-white/40 hover:text-white ml-2">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Scoring Guide */}
      <div className="glass-card rounded-3xl overflow-hidden">
        <button onClick={() => setShowGuide(!showGuide)} className="w-full flex items-center justify-between px-6 py-3 text-left">
          <span className="flex items-center gap-2 text-sm text-white/70">
            <HelpCircle size={16} className="text-teal-400" />
            <span className="font-medium text-white">How scoring works</span>
            <span className="text-white/30">— what all these numbers mean</span>
          </span>
          <ChevronDown size={16} className={`text-white/30 transition-transform ${showGuide ? "rotate-180" : ""}`} />
        </button>
        {showGuide && (
          <div className="px-6 pb-5 border-t border-white/5 pt-4 space-y-3 text-[13px] leading-relaxed text-white/60">
            <p className="text-white/80 font-medium">Every hour, AI reads each chatter's conversations and gives them a score out of 100:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              <div><span className="text-blue-400 font-medium">SLA (25 pts)</span> — How fast they reply. Under 5 minutes = full marks. Slow replies lose points.</div>
              <div><span className="text-teal-400 font-medium">Follow-up (20 pts)</span> — When a fan goes quiet, does the chatter re-engage them? Or let them disappear?</div>
              <div><span className="text-purple-400 font-medium">Triggers (20 pts)</span> — When a fan hints they want content, did the chatter sell immediately? Hesitating on a buying signal = lost money.</div>
              <div><span className="text-amber-400 font-medium">Quality (20 pts)</span> — Are messages creative, personal, in-character? Or copy-paste robotic garbage?</div>
              <div><span className="text-emerald-400 font-medium">Revenue (15 pts)</span> — Did they actually close a sale? PPV sent, tip received, subscription renewed.</div>
              <div><span className="text-red-400 font-medium">Penalties</span> — Copy-paste blasting, missed buying signals, and spamming all reduce the score.</div>
            </div>
            <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-white/40 text-xs">
              <div><span className="text-white/60 font-medium">Skill Radar</span> — Spider chart comparing chatters across all 5 areas. Bigger shape = better all-rounder.</div>
              <div><span className="text-white/60 font-medium">Archetypes</span> — AI detects chatting personality. "Tease" sells well. "Friend Zone" means they're being too nice to close.</div>
              <div><span className="text-white/60 font-medium">Creator Workload</span> — How many chatter hours each model account is getting. Uneven = some models understaffed.</div>
              <div><span className="text-white/60 font-medium">Performance Tags</span> — Click any tag to see which chatters have that strength or weakness.</div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <KpiStatsRow data={d.kpis || { activeChatters: 0, totalSessions: 0, avgTeamScore: 0, totalHoursWorked: 0, scoringSessionsCount: 0, liveNow: 0 }} />

      {/* Live Activity — who's online and are they actually working */}
      <LiveActivityPanel data={d.liveActivity || []} avgActivity={d.avgActivity || null} />

      {/* Timeline — 24h activity blocks per member */}
      <TimelinePanel creatorId={creatorFilter} />

      {/* Row 1: Performance Trend (full width) */}
      <PerformanceTrendChart data={d.performanceTrend || []} />

      {/* Row 2: Gauges + Category Bars + Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TeamGaugePanel avgScore={d.kpis?.avgTeamScore || 0} categoryAverages={d.categoryAverages || { sla: 0, followup: 0, trigger: 0, quality: 0, revenue: 0 }} />
        <ScoreCategoryBars
          data={d.categoryAverages || { sla: 0, followup: 0, trigger: 0, quality: 0, revenue: 0 }}
          conversations={d.conversationSamples || []}
        />
        <ChatterRadarChart data={d.chatterRadar || []} />
      </div>

      {/* Row 3: Pie Charts + Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ArchetypePieChart data={d.archetypeDistribution || []} />
        <CreatorWorkloadPie data={d.creatorWorkload || []} />
        <ActivityByHourBar data={d.activityByHour || []} />
      </div>

      {/* Row 4: Chatter Reports by Hubstaff Team — who has reports, who doesn't */}
      <TeamReportsPanel days={days} onChatterClick={(email) => setShiftReportTarget({ email })} />

      {/* Creator ↔ Chatter Wiring — live sessions, overrides, schedules */}
      <WiringPanel />

      {/* Chatter Performance Table — real revenue stats, own date picker */}
      <ChatterPerformanceTable
        creatorFilter={creatorFilter !== "all" ? creatorFilter : undefined}
        onChatterClick={(email, creatorId) => setShiftReportTarget({ email, creatorId })}
      />

      {/* Row 5: Chatter Rankings bar chart (full width) — click name for shift report */}
      <ChatterComparisonBar data={d.chatterComparison || []} onChatterClick={(email, creatorId) => setShiftReportTarget({ email, creatorId })} />

      {/* Row 5: Hours + Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HoursStackedArea data={d.hoursOverTime || []} />
        <TagCloudPanel data={d.tagCloud || { strengths: [], weaknesses: [] }} />
      </div>

      {/* Row 6: Copy-Paste Blasting (full width) */}
      <CopyPasteBlasting data={d.copyPasteBlasters || []} />

      {/* Row 7: Content Performance (full width) */}
      <ContentPerformancePanel
        days={contentDateRange.days}
        creatorFilter={creatorFilter}
        startDate={contentDateRange.startDate}
        endDate={contentDateRange.endDate}
        dateLabel={contentDateRange.label}
        onDateChange={setContentDateRange}
      />

      {/* Row 8: Conversation Scoring with Chat Bubbles (full width) */}
      <ConversationPhoneGallery data={d.conversationSamples || []} />

      {/* Shift Report Modal */}
      {shiftReportTarget && (
        <ShiftReportPanel
          email={shiftReportTarget.email}
          creatorId={shiftReportTarget.creatorId || (creatorFilter !== "all" ? creatorFilter : undefined)}
          onClose={() => setShiftReportTarget(null)}
        />
      )}
    </div>
  );
}

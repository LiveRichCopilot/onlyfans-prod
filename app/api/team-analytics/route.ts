import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Optional creator filter — when set, all data scoped to that creator
  const creatorWhere = creatorId ? { creatorId } : {};

  try {
    const [
      sessions,
      hourlyScores,
      profiles,
      liveSessions,
      creators,
    ] = await Promise.all([
      prisma.chatterSession.findMany({
        where: { clockIn: { gte: since }, ...creatorWhere },
        include: { creator: { select: { name: true } } },
      }),
      prisma.chatterHourlyScore.findMany({
        where: { createdAt: { gte: since }, ...creatorWhere },
        include: { creator: { select: { name: true } } },
      }),
      prisma.chatterProfile.findMany({
        where: creatorWhere,
        include: { creator: { select: { name: true } } },
      }),
      prisma.chatterSession.count({ where: { isLive: true, ...creatorWhere } }),
      prisma.creator.findMany({ where: { active: true }, select: { id: true, name: true } }),
    ]);

    // --- KPIs ---
    const uniqueEmails = new Set(sessions.map(s => s.email));
    const totalHours = sessions.reduce((sum, s) => {
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      return sum + (end - new Date(s.clockIn).getTime()) / 3600000;
    }, 0);
    const avgTeamScore = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.totalScore, 0) / hourlyScores.length)
      : 0;

    const kpis = {
      activeChatters: uniqueEmails.size,
      totalSessions: sessions.length,
      avgTeamScore,
      totalHoursWorked: parseFloat(totalHours.toFixed(1)),
      scoringSessionsCount: hourlyScores.length,
      liveNow: liveSessions,
    };

    // --- Performance Trend (daily) ---
    const trendMap = new Map<string, { scores: number[]; sla: number[]; followup: number[]; trigger: number[]; quality: number[]; revenue: number[] }>();
    for (const h of hourlyScores) {
      const date = new Date(h.windowStart).toISOString().split("T")[0];
      if (!trendMap.has(date)) trendMap.set(date, { scores: [], sla: [], followup: [], trigger: [], quality: [], revenue: [] });
      const d = trendMap.get(date)!;
      d.scores.push(h.totalScore);
      d.sla.push(h.slaScore);
      d.followup.push(h.followupScore);
      d.trigger.push(h.triggerScore);
      d.quality.push(h.qualityScore);
      d.revenue.push(h.revenueScore);
    }
    const performanceTrend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        avgScore: Math.round(avg(d.scores)),
        sessionCount: d.scores.length,
        avgSla: Math.round(avg(d.sla)),
        avgFollowup: Math.round(avg(d.followup)),
        avgTrigger: Math.round(avg(d.trigger)),
        avgQuality: Math.round(avg(d.quality)),
        avgRevenue: Math.round(avg(d.revenue)),
      }));

    // --- Archetype Distribution ---
    const archCounts = new Map<string, number>();
    for (const h of hourlyScores) {
      if (h.detectedArchetype) archCounts.set(h.detectedArchetype, (archCounts.get(h.detectedArchetype) || 0) + 1);
    }
    const archetypeDistribution = [...archCounts.entries()].map(([archetype, count]) => ({ archetype, count }));

    // --- Chatter Comparison ---
    const chatterComparison = profiles.map(p => ({
      name: p.chatterName || p.chatterEmail.split("@")[0],
      email: p.chatterEmail,
      creator: p.creator.name || "Unknown",
      avgScore: Math.round(p.avgTotalScore),
      totalSessions: p.totalScoringSessions,
      improvementIndex: Math.round(p.improvementIndex * 100) / 100,
    })).sort((a, b) => b.avgScore - a.avgScore);

    // --- Category Averages ---
    const categoryAverages = profiles.length > 0 ? {
      sla: Math.round(avg(profiles.map(p => p.avgSlaScore))),
      followup: Math.round(avg(profiles.map(p => p.avgFollowupScore))),
      trigger: Math.round(avg(profiles.map(p => p.avgTriggerScore))),
      quality: Math.round(avg(profiles.map(p => p.avgQualityScore))),
      revenue: Math.round(avg(profiles.map(p => p.avgRevenueScore))),
    } : { sla: 0, followup: 0, trigger: 0, quality: 0, revenue: 0 };

    // --- Chatter Radar ---
    const chatterRadar = profiles.slice(0, 8).map(p => ({
      name: p.chatterName || p.chatterEmail.split("@")[0],
      sla: Math.round(p.avgSlaScore),
      followup: Math.round(p.avgFollowupScore),
      trigger: Math.round(p.avgTriggerScore),
      quality: Math.round(p.avgQualityScore),
      revenue: Math.round(p.avgRevenueScore),
    }));

    // --- Hours Over Time (stacked by chatter) ---
    const hoursMap = new Map<string, Record<string, number>>();
    for (const s of sessions) {
      const date = new Date(s.clockIn).toISOString().split("T")[0];
      const name = s.email.split("@")[0];
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      const hrs = (end - new Date(s.clockIn).getTime()) / 3600000;
      if (!hoursMap.has(date)) hoursMap.set(date, {});
      const d = hoursMap.get(date)!;
      d[name] = parseFloat(((d[name] || 0) + hrs).toFixed(1));
    }
    const hoursOverTime = [...hoursMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, chatters]) => ({ date, ...chatters }));

    // --- Activity By Hour ---
    const hourBuckets = new Map<number, { count: number; scores: number[] }>();
    for (const h of hourlyScores) {
      const hr = new Date(h.windowStart).getUTCHours();
      if (!hourBuckets.has(hr)) hourBuckets.set(hr, { count: 0, scores: [] });
      const b = hourBuckets.get(hr)!;
      b.count++;
      b.scores.push(h.totalScore);
    }
    const activityByHour = Array.from({ length: 24 }, (_, i) => {
      const b = hourBuckets.get(i);
      return { hour: i, sessionCount: b?.count || 0, avgScore: b ? Math.round(avg(b.scores)) : 0 };
    });

    // --- Tag Cloud (with chatter names) ---
    const strengthMap = new Map<string, { count: number; chatters: Set<string> }>();
    const weaknessMap = new Map<string, { count: number; chatters: Set<string> }>();
    for (const h of hourlyScores) {
      const name = h.chatterEmail.split("@")[0];
      for (const t of h.strengthTags) {
        if (!strengthMap.has(t)) strengthMap.set(t, { count: 0, chatters: new Set() });
        const e = strengthMap.get(t)!;
        e.count++;
        e.chatters.add(name);
      }
      for (const t of h.mistakeTags) {
        if (!weaknessMap.has(t)) weaknessMap.set(t, { count: 0, chatters: new Set() });
        const e = weaknessMap.get(t)!;
        e.count++;
        e.chatters.add(name);
      }
    }
    const tagCloud = {
      strengths: [...strengthMap.entries()].map(([tag, e]) => ({ tag, count: e.count, chatters: [...e.chatters] })).sort((a, b) => b.count - a.count),
      weaknesses: [...weaknessMap.entries()].map(([tag, e]) => ({ tag, count: e.count, chatters: [...e.chatters] })).sort((a, b) => b.count - a.count),
    };

    // --- Creator Workload ---
    const creatorMap = new Map<string, { id: string; name: string; sessionCount: number; totalHours: number }>();
    for (const s of sessions) {
      const name = s.creator.name || "Unknown";
      if (!creatorMap.has(s.creatorId)) creatorMap.set(s.creatorId, { id: s.creatorId, name, sessionCount: 0, totalHours: 0 });
      const c = creatorMap.get(s.creatorId)!;
      c.sessionCount++;
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      c.totalHours += (end - new Date(s.clockIn).getTime()) / 3600000;
    }
    const creatorWorkload = [...creatorMap.values()].map(c => ({
      creatorId: c.id,
      creatorName: c.name,
      sessionCount: c.sessionCount,
      totalHours: parseFloat(c.totalHours.toFixed(1)),
    }));

    // --- Conversation Samples (for scoring detail section) ---
    const recentScored = await prisma.chatterHourlyScore.findMany({
      where: { aiNotes: { not: null }, createdAt: { gte: since }, ...creatorWhere },
      include: { creator: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
    const conversationSamples = recentScored.map(h => ({
      chatterEmail: h.chatterEmail,
      chatterName: h.chatterEmail.split("@")[0],
      creator: h.creator.name || "Unknown",
      date: h.windowStart.toISOString(),
      totalScore: h.totalScore,
      slaScore: h.slaScore,
      followupScore: h.followupScore,
      triggerScore: h.triggerScore,
      qualityScore: h.qualityScore,
      revenueScore: h.revenueScore,
      archetype: h.detectedArchetype,
      aiNotes: h.aiNotes,
      notableQuotes: h.notableQuotes,
      conversationData: h.conversationData,
      mistakeTags: h.mistakeTags,
      strengthTags: h.strengthTags,
      penalties: {
        copyPaste: h.copyPastePenalty,
        missedTrigger: h.missedTriggerPenalty,
        spam: h.spamPenalty,
      },
    }));

    // --- Copy-Paste Blasting (aggregated across all scored hours) ---
    const blastScores = await prisma.chatterHourlyScore.findMany({
      where: { NOT: { copyPasteBlasts: { equals: Prisma.DbNull } }, createdAt: { gte: since }, ...creatorWhere },
      include: { creator: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const blasterMap = new Map<string, { chatterName: string; chatterEmail: string; creator: string; blasts: Map<string, number> }>();
    for (const s of blastScores) {
      const key = `${s.chatterEmail}|${s.creatorId}`;
      if (!blasterMap.has(key)) blasterMap.set(key, { chatterName: s.chatterEmail.split("@")[0], chatterEmail: s.chatterEmail, creator: (s as any).creator?.name || "Unknown", blasts: new Map() });
      const entry = blasterMap.get(key)!;
      const blasts = Array.isArray(s.copyPasteBlasts) ? s.copyPasteBlasts : [];
      for (const b of blasts as any[]) {
        const existing = entry.blasts.get(b.message) || 0;
        entry.blasts.set(b.message, existing + (b.fanCount || 0));
      }
    }
    const copyPasteBlasters = [...blasterMap.values()].map(e => ({
      chatterName: e.chatterName,
      chatterEmail: e.chatterEmail,
      creator: e.creator,
      uniqueBlasts: e.blasts.size,
      totalBlastSends: [...e.blasts.values()].reduce((a, b) => a + b, 0),
      blasts: [...e.blasts.entries()].sort((a, b) => b[1] - a[1]).map(([message, fanCount]) => ({ message, fanCount })),
    })).filter(e => e.totalBlastSends > 0);

    // Include all active creators for the filter dropdown (unfiltered)
    const allCreators = creators.map(c => ({ creatorId: c.id, creatorName: c.name || "Unknown" }));

    return NextResponse.json({
      kpis,
      performanceTrend,
      archetypeDistribution,
      chatterComparison,
      categoryAverages,
      chatterRadar,
      hoursOverTime,
      activityByHour,
      tagCloud,
      creatorWorkload,
      conversationSamples,
      copyPasteBlasters,
      allCreators,
    });
  } catch (err: any) {
    console.error("Team analytics error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

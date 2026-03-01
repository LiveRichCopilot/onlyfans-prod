import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getActivities,
  getToolUsages,
} from "@/lib/hubstaff";
import { resolveHubstaffUser } from "@/lib/hubstaff-resolve";

export const dynamic = "force-dynamic";

/**
 * Shift Report API — Cross-references Hubstaff + DB scoring data
 * to verify chatter activity claims.
 *
 * Query params:
 *   email     - chatter email (required)
 *   creatorId - optional, scopes to a specific creator
 *   date      - YYYY-MM-DD, defaults to today (UK time)
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const creatorId = req.nextUrl.searchParams.get("creatorId") || null;
  const dateParam = req.nextUrl.searchParams.get("date");

  // Use UK timezone for "today" default
  const targetDate = dateParam || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const dayStart = new Date(`${targetDate}T00:00:00Z`);
  const dayEnd = new Date(`${targetDate}T23:59:59Z`);

  const creatorWhere = creatorId ? { creatorId } : {};

  try {
    // --- DB Data: Sessions + Scoring ---
    const [sessions, hourlyScores, profile, schedule] = await Promise.all([
      prisma.chatterSession.findMany({
        where: {
          email,
          clockIn: { gte: dayStart, lte: dayEnd },
          ...creatorWhere,
        },
        include: { creator: { select: { name: true } } },
        orderBy: { clockIn: "asc" },
      }),
      prisma.chatterHourlyScore.findMany({
        where: {
          chatterEmail: email,
          windowStart: { gte: dayStart },
          windowEnd: { lte: dayEnd },
          ...creatorWhere,
        },
        orderBy: { windowStart: "asc" },
      }),
      prisma.chatterProfile.findFirst({
        where: { chatterEmail: email, ...creatorWhere },
      }),
      prisma.chatterSchedule.findFirst({
        where: { email, ...creatorWhere },
        select: { name: true, shift: true },
      }),
    ]);

    // Compute session-level metrics
    const totalShiftDurationHrs = sessions.reduce((sum, s) => {
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      return sum + (end - new Date(s.clockIn).getTime()) / 3600000;
    }, 0);

    const firstClockIn = sessions.length > 0 ? sessions[0].clockIn.toISOString() : null;
    const lastClockOut = sessions.length > 0
      ? (sessions[sessions.length - 1].clockOut?.toISOString() || null)
      : null;

    // Scoring aggregates
    const totalMessages = hourlyScores.reduce((s, h) => s + h.messagesAnalyzed, 0);
    const totalConversations = hourlyScores.reduce((s, h) => s + h.conversationsScanned, 0);
    const avgScore = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.totalScore, 0) / hourlyScores.length)
      : 0;

    // Score breakdown averages
    const avgSla = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.slaScore, 0) / hourlyScores.length)
      : 0;
    const avgFollowup = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.followupScore, 0) / hourlyScores.length)
      : 0;
    const avgTrigger = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.triggerScore, 0) / hourlyScores.length)
      : 0;
    const avgQuality = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.qualityScore, 0) / hourlyScores.length)
      : 0;
    const avgRevenue = hourlyScores.length > 0
      ? Math.round(hourlyScores.reduce((s, h) => s + h.revenueScore, 0) / hourlyScores.length)
      : 0;

    // Copy-paste blast count
    const totalBlasts = hourlyScores.reduce((s, h) => {
      const blasts = Array.isArray(h.copyPasteBlasts) ? h.copyPasteBlasts : [];
      return s + blasts.length;
    }, 0);

    // Penalty totals
    const totalCopyPastePenalty = hourlyScores.reduce((s, h) => s + h.copyPastePenalty, 0);
    const totalMissedTriggerPenalty = hourlyScores.reduce((s, h) => s + h.missedTriggerPenalty, 0);
    const totalSpamPenalty = hourlyScores.reduce((s, h) => s + h.spamPenalty, 0);

    // Collect all strength/mistake tags
    const allStrengths = hourlyScores.flatMap(h => h.strengthTags);
    const allMistakes = hourlyScores.flatMap(h => h.mistakeTags);

    // Hourly score timeline — include conversation evidence
    const hourlyTimeline = hourlyScores.map(h => ({
      windowStart: h.windowStart.toISOString(),
      windowEnd: h.windowEnd.toISOString(),
      totalScore: h.totalScore,
      messagesAnalyzed: h.messagesAnalyzed,
      conversationsScanned: h.conversationsScanned,
      archetype: h.detectedArchetype,
      aiNotes: h.aiNotes,
      notableQuotes: h.notableQuotes || null,
      conversationData: h.conversationData || null,
      scores: { sla: h.slaScore, followup: h.followupScore, trigger: h.triggerScore, quality: h.qualityScore, revenue: h.revenueScore },
      strengthTags: h.strengthTags,
      mistakeTags: h.mistakeTags,
    }));

    // Computed: messages per hour
    const messagesPerHour = totalShiftDurationHrs > 0
      ? Math.round(totalMessages / totalShiftDurationHrs)
      : 0;

    // --- Hubstaff Data ---
    let hubstaffActivity: {
      keyboard: number;
      mouse: number;
      overall: number;
      totalTrackedSeconds: number;
      totalTrackedHrs: number;
    } | null = null;
    let topApps: { name: string; seconds: number; pct: number }[] = [];

    try {
      // Resolve Hubstaff user (auto-matches by email/name if not manually mapped)
      const resolved = await resolveHubstaffUser(email, creatorId);

      if (resolved) {
        const hsUserId = resolved.hubstaffUserId;
        const isoStart = `${targetDate}T00:00:00Z`;
        const isoEnd = `${targetDate}T23:59:59Z`;

        // Get activity slots for the day — filter by userId server-side to avoid pagination cutoff
        const [userActivities, userTools] = await Promise.all([
          getActivities(isoStart, isoEnd, hsUserId).catch(() => []),
          getToolUsages(isoStart, isoEnd, hsUserId).catch(() => []),
        ]);

        if (userActivities.length > 0) {
          const totalTracked = userActivities.reduce((s, a) => s + a.tracked, 0);
          // Hubstaff returns keyboard/mouse/overall as SECONDS of activity, not percentages.
          // Convert to percentage: (total_activity_seconds / total_tracked_seconds) * 100
          const totalKeyboard = userActivities.reduce((s, a) => s + a.keyboard, 0);
          const totalMouse = userActivities.reduce((s, a) => s + a.mouse, 0);
          const totalOverall = userActivities.reduce((s, a) => s + a.overall, 0);

          hubstaffActivity = {
            keyboard: totalTracked > 0 ? Math.round((totalKeyboard / totalTracked) * 100) : 0,
            mouse: totalTracked > 0 ? Math.round((totalMouse / totalTracked) * 100) : 0,
            overall: totalTracked > 0 ? Math.round((totalOverall / totalTracked) * 100) : 0,
            totalTrackedSeconds: totalTracked,
            totalTrackedHrs: parseFloat((totalTracked / 3600).toFixed(2)),
          };
        }

        // Aggregate tool usage
        if (userTools.length > 0) {
          const toolMap = new Map<string, number>();
          for (const t of userTools) {
            toolMap.set(t.name, (toolMap.get(t.name) || 0) + t.tracked);
          }
          const totalToolTime = [...toolMap.values()].reduce((a, b) => a + b, 0);
          topApps = [...toolMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, seconds]) => ({
              name,
              seconds,
              pct: totalToolTime > 0 ? Math.round((seconds / totalToolTime) * 100) : 0,
            }));
        }
      }
    } catch (e: any) {
      console.error("[ShiftReport] Hubstaff fetch error:", e.message);
      // Continue without Hubstaff data
    }

    // --- Computed Verdicts ---
    const trackedHrs = hubstaffActivity?.totalTrackedHrs || 0;
    const idleTimeHrs = totalShiftDurationHrs > 0
      ? Math.max(0, totalShiftDurationHrs - trackedHrs)
      : 0;

    const revenuePerHour = totalShiftDurationHrs > 0
      ? Math.round(avgRevenue / Math.max(1, totalShiftDurationHrs))
      : 0;

    // Activity rating
    const overallPct = hubstaffActivity?.overall || 0;
    let activityVerdict: "excellent" | "good" | "low" | "critical" | "no_data" = "no_data";
    if (hubstaffActivity) {
      if (overallPct >= 60) activityVerdict = "excellent";
      else if (overallPct >= 40) activityVerdict = "good";
      else if (overallPct >= 20) activityVerdict = "low";
      else activityVerdict = "critical";
    }

    // Effort rating based on messages per hour
    let effortVerdict: "high" | "moderate" | "low" | "idle" = "idle";
    if (messagesPerHour >= 20) effortVerdict = "high";
    else if (messagesPerHour >= 10) effortVerdict = "moderate";
    else if (messagesPerHour >= 3) effortVerdict = "low";

    return NextResponse.json({
      email,
      name: schedule?.name || profile?.chatterName || email.split("@")[0],
      creatorName: sessions[0]?.creator?.name || profile?.creatorId || null,
      date: targetDate,
      shift: schedule?.shift || null,

      // Session data
      sessionCount: sessions.length,
      firstClockIn,
      lastClockOut,
      totalShiftDurationHrs: parseFloat(totalShiftDurationHrs.toFixed(2)),

      // Scoring data
      scoringWindows: hourlyScores.length,
      avgScore,
      scoreBreakdown: { sla: avgSla, followup: avgFollowup, trigger: avgTrigger, quality: avgQuality, revenue: avgRevenue },
      totalMessages,
      totalConversations,
      totalBlasts,
      penalties: { copyPaste: totalCopyPastePenalty, missedTrigger: totalMissedTriggerPenalty, spam: totalSpamPenalty },
      strengthTags: [...new Set(allStrengths)],
      mistakeTags: [...new Set(allMistakes)],
      hourlyTimeline,
      dominantArchetype: profile?.dominantArchetype || null,

      // Hubstaff data
      hubstaff: hubstaffActivity,
      topApps,

      // Computed
      messagesPerHour,
      revenuePerHour,
      idleTimeHrs: parseFloat(idleTimeHrs.toFixed(2)),

      // Verdicts
      activityVerdict,
      effortVerdict,
    });
  } catch (err: any) {
    console.error("[ShiftReport] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

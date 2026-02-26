import { NextRequest, NextResponse } from "next/server";
import {
  listMembers,
  getActivities,
  getDailyActivities,
  getLastActivities,
  getAttendanceShifts,
  getAttendanceSchedules,
  getProjects,
} from "@/lib/hubstaff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/team/hubstaff?date=YYYY-MM-DD&days=7 — Comprehensive chatter stats */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date") || todayUTC();
    const days = Math.min(parseInt(url.searchParams.get("days") || "7"), 31);

    // Calculate date ranges
    const startDate = dateParam;
    const endDate = dateParam;
    const dailyStartDate = subtractDays(dateParam, days - 1);

    // Start of today UTC for activity time range
    const dayStartUtc = `${dateParam}T00:00:00Z`;
    const dayEndUtc = `${dateParam}T23:59:59Z`;

    // Pull everything in parallel
    const [
      membersData,
      todayActivities,
      dailyActivities,
      lastActivities,
      attendanceSchedules,
      attendanceShifts,
      projects,
      mappings,
      schedules,
      liveSessions,
      recentScores,
    ] = await Promise.all([
      listMembers(),
      getActivities(dayStartUtc, dayEndUtc).catch(() => []),
      getDailyActivities(dailyStartDate, dateParam).catch(() => []),
      getLastActivities().catch(() => []),
      getAttendanceSchedules(dateParam, dateParam).catch(() => ({ schedules: [], users: [] })),
      getAttendanceShifts(dateParam, dateParam).catch(() => []),
      getProjects().catch(() => []),
      prisma.hubstaffUserMapping.findMany(),
      prisma.chatterSchedule.findMany({
        include: { creator: { select: { id: true, name: true, ofUsername: true } } },
      }),
      prisma.chatterSession.findMany({
        where: { isLive: true },
        select: { email: true, creatorId: true, clockIn: true },
      }),
      prisma.chatterHourlyScore.findMany({
        where: {
          createdAt: { gte: new Date(dailyStartDate + "T00:00:00Z") },
        },
        select: {
          chatterEmail: true,
          creatorId: true,
          totalScore: true,
          windowStart: true,
          conversationsScanned: true,
          messagesAnalyzed: true,
          revenueScore: true,
          slaScore: true,
          detectedArchetype: true,
        },
        orderBy: { windowStart: "desc" },
      }),
    ]);

    // Build lookup maps
    const userMap = new Map<number, any>();
    for (const u of membersData.users) {
      userMap.set(u.id, u);
    }

    const mappingByUserId = new Map<string, any>();
    const mappingByEmail = new Map<string, any>();
    for (const m of mappings) {
      mappingByUserId.set(m.hubstaffUserId, m);
      mappingByEmail.set(m.chatterEmail, m);
    }

    const projectMap = new Map<number, string>();
    for (const p of projects) {
      projectMap.set(p.id, p.name);
    }

    // Aggregate today's activities per user
    const todayByUser = new Map<number, {
      tracked: number;
      keyboard: number;
      mouse: number;
      overall: number;
      slots: number;
      byProject: Map<number, number>;
    }>();

    for (const act of todayActivities) {
      let entry = todayByUser.get(act.user_id);
      if (!entry) {
        entry = { tracked: 0, keyboard: 0, mouse: 0, overall: 0, slots: 0, byProject: new Map() };
        todayByUser.set(act.user_id, entry);
      }
      entry.tracked += act.tracked || 0;
      entry.keyboard += act.keyboard || 0;
      entry.mouse += act.mouse || 0;
      entry.overall += act.overall || 0;
      entry.slots += 1;
      if (act.project_id) {
        entry.byProject.set(
          act.project_id,
          (entry.byProject.get(act.project_id) || 0) + (act.tracked || 0),
        );
      }
    }

    // Aggregate daily activities per user
    const dailyByUser = new Map<number, Array<{ date: string; tracked: number; activity: number }>>();
    for (const d of dailyActivities) {
      let arr = dailyByUser.get(d.user_id);
      if (!arr) {
        arr = [];
        dailyByUser.set(d.user_id, arr);
      }
      arr.push({
        date: d.date,
        tracked: d.tracked || 0,
        activity: d.overall || 0,
      });
    }

    // Last activity (online/offline) by user
    const lastByUser = new Map<number, any>();
    for (const la of lastActivities) {
      lastByUser.set(la.user_id, la);
    }

    // Attendance schedules by user (expected shifts) — could be multiple
    const schedulesByUserId = new Map<number, any[]>();
    for (const s of attendanceSchedules.schedules) {
      const uid = Number(s.user_id);
      const arr = schedulesByUserId.get(uid) ?? [];
      arr.push(s);
      schedulesByUserId.set(uid, arr);
    }

    // Attendance shifts by user (actual clock-in/out) — multiple per day
    const shiftsByUserId = new Map<number, any[]>();
    for (const s of attendanceShifts) {
      const uid = Number(s.user_id);
      const arr = shiftsByUserId.get(uid) ?? [];
      arr.push(s);
      shiftsByUserId.set(uid, arr);
    }

    // Schedule by email → creators
    const scheduleByEmail = new Map<string, Array<{
      creatorId: string;
      creatorName: string | null;
      ofUsername: string | null;
      shift: string;
    }>>();
    for (const s of schedules) {
      let arr = scheduleByEmail.get(s.email);
      if (!arr) {
        arr = [];
        scheduleByEmail.set(s.email, arr);
      }
      arr.push({
        creatorId: s.creatorId,
        creatorName: s.creator.name,
        ofUsername: s.creator.ofUsername,
        shift: s.shift,
      });
    }

    // Live sessions by email
    const liveByEmail = new Map<string, any[]>();
    for (const ls of liveSessions) {
      let arr = liveByEmail.get(ls.email);
      if (!arr) {
        arr = [];
        liveByEmail.set(ls.email, arr);
      }
      arr.push(ls);
    }

    // Scores by email
    const scoresByEmail = new Map<string, any[]>();
    for (const sc of recentScores) {
      let arr = scoresByEmail.get(sc.chatterEmail);
      if (!arr) {
        arr = [];
        scoresByEmail.set(sc.chatterEmail, arr);
      }
      arr.push(sc);
    }

    // --- Build the final chatter stats array ---
    const chatters: any[] = [];

    for (const member of membersData.members) {
      if (member.membership_status !== "active") continue;

      const user = userMap.get(member.user_id);
      if (!user) continue;

      const mapping = mappingByUserId.get(String(member.user_id));
      const chatterEmail = mapping?.chatterEmail || user.email;

      const today = todayByUser.get(member.user_id);
      const daily = dailyByUser.get(member.user_id) || [];
      const lastAct = lastByUser.get(member.user_id);
      const attendSchedules = schedulesByUserId.get(member.user_id) || [];
      const attendShifts = shiftsByUserId.get(member.user_id) || [];
      const assignedModels = scheduleByEmail.get(chatterEmail) || [];
      const sessions = liveByEmail.get(chatterEmail) || [];
      const scores = scoresByEmail.get(chatterEmail) || [];

      // Compute averages for today
      // Hubstaff activity values are 0-600 per 10-min slot (seconds of input activity)
      // Convert to percentage: (activity_seconds / tracked_seconds) * 100
      const avgActivityPct = today && today.tracked > 0
        ? Math.round((today.overall / today.tracked) * 100)
        : 0;
      const avgKeyboardPct = today && today.tracked > 0
        ? Math.round((today.keyboard / today.tracked) * 100)
        : 0;
      const avgMousePct = today && today.tracked > 0
        ? Math.round((today.mouse / today.tracked) * 100)
        : 0;

      // Project breakdown
      const projectBreakdown: Array<{ project: string; seconds: number }> = [];
      if (today) {
        for (const [pid, secs] of today.byProject) {
          projectBreakdown.push({
            project: projectMap.get(pid) || `Project ${pid}`,
            seconds: secs,
          });
        }
        projectBreakdown.sort((a, b) => b.seconds - a.seconds);
      }

      // Score summary
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((s, sc) => s + sc.totalScore, 0) / scores.length)
        : null;
      const totalConversations = scores.reduce((s, sc) => s + sc.conversationsScanned, 0);
      const totalMessages = scores.reduce((s, sc) => s + sc.messagesAnalyzed, 0);

      // Determine online status
      const isOnline = lastAct?.last_activity_at
        ? (Date.now() - new Date(lastAct.last_activity_at).getTime()) < 600_000 // active in last 10 min
        : false;

      chatters.push({
        hubstaffUserId: member.user_id,
        name: user.name,
        email: user.email,
        chatterEmail,
        role: member.membership_role,
        isMapped: !!mapping,
        isOnline,
        lastActivityAt: lastAct?.last_activity_at || member.last_client_activity,

        // Today's Hubstaff stats
        today: {
          trackedSeconds: today?.tracked || 0,
          trackedFormatted: formatDuration(today?.tracked || 0),
          activityPercent: avgActivityPct,
          keyboardPercent: avgKeyboardPct,
          mousePercent: avgMousePct,
          slots: today?.slots || 0,
          projectBreakdown,
        },

        // Daily trend (last N days)
        dailyTrend: daily.map((d) => ({
          date: d.date,
          trackedSeconds: d.tracked,
          trackedFormatted: formatDuration(d.tracked),
          activityPercent: d.activity,
        })),

        // Attendance (expected schedule + actual shifts)
        attendance: {
          schedules: attendSchedules.map((s: any) => ({
            startTime: s.start_time,
            durationHours: Math.round((s.duration || 0) / 3600),
            weekdays: s.weekdays,
            repeatSchedule: s.repeat_schedule,
          })),
          shifts: attendShifts.map((s: any) => ({
            status: s.status,
            actualStart: s.actual_start_time,
            actualStop: s.actual_stop_time,
            actualDurationMin: s.actual_duration ? Math.round(s.actual_duration / 60) : null,
            scheduledDurationMin: s.duration ? Math.round(s.duration / 60) : null,
          })),
          // Computed summary
          totalWorkedMin: attendShifts.reduce(
            (sum: number, s: any) => sum + (s.actual_duration ? Math.round(s.actual_duration / 60) : 0),
            0,
          ),
          firstClockIn: attendShifts
            .filter((s: any) => s.actual_start_time)
            .sort((a: any, b: any) => a.actual_start_time.localeCompare(b.actual_start_time))[0]
            ?.actual_start_time || null,
          lastClockOut: attendShifts
            .filter((s: any) => s.actual_stop_time)
            .sort((a: any, b: any) => b.actual_stop_time.localeCompare(a.actual_stop_time))[0]
            ?.actual_stop_time || null,
          shiftStatus: attendShifts[0]?.status || "no_schedule",
        },

        // Model assignments
        assignedModels,

        // Live session status
        liveSessions: sessions.map((s) => ({
          creatorId: s.creatorId,
          clockIn: s.clockIn,
        })),

        // Performance scores
        scoring: {
          avgScore,
          totalScored: scores.length,
          totalConversations,
          totalMessages,
          recentScores: scores.slice(0, 10).map((sc) => ({
            creatorId: sc.creatorId,
            totalScore: sc.totalScore,
            slaScore: sc.slaScore,
            revenueScore: sc.revenueScore,
            archetype: sc.detectedArchetype,
            windowStart: sc.windowStart,
          })),
        },
      });
    }

    // Sort: online first, then by tracked time desc
    chatters.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.today.trackedSeconds - a.today.trackedSeconds;
    });

    return NextResponse.json({
      date: dateParam,
      daysRange: days,
      totalMembers: chatters.length,
      onlineNow: chatters.filter((c) => c.isOnline).length,
      projects: projects.map((p: any) => ({ id: p.id, name: p.name })),
      chatters,
    });
  } catch (e: any) {
    console.error("[Hubstaff Stats]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// --- Helpers ---

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

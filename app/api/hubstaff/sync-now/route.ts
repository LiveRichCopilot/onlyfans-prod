import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLastActivities, getActivities, getConfig, updateLastSync } from "@/lib/hubstaff";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * POST /api/hubstaff/sync-now
 * Manual sync trigger from the Hubstaff admin page.
 * Same logic as the cron but callable from the UI.
 */
export async function POST() {
  try {
    const config = await getConfig();
    if (!config || !config.syncEnabled) {
      return NextResponse.json({ error: "Hubstaff not configured or sync disabled" }, { status: 400 });
    }

    const mappings = await prisma.hubstaffUserMapping.findMany();
    if (mappings.length === 0) {
      return NextResponse.json({ error: "No user mappings configured" }, { status: 400 });
    }

    const userIdToMapping = new Map<number, typeof mappings[0]>();
    for (const m of mappings) {
      userIdToMapping.set(parseInt(m.hubstaffUserId, 10), m);
    }

    // Get who's online
    const lastActivities = await getLastActivities(config.organizationId);
    const onlineUserIds = new Set<number>();
    for (const act of lastActivities) {
      if (act.online) onlineUserIds.add(act.user_id);
    }

    // Pull activity data for last 30 min
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    let activityBlocks: Awaited<ReturnType<typeof getActivities>> = [];
    try {
      activityBlocks = await getActivities(thirtyMinAgo.toISOString(), now.toISOString());
    } catch (e: any) {
      console.warn("[Hubstaff Sync Now] Activity fetch failed:", e.message);
    }

    // Aggregate per user: sum seconds, then convert to percentage
    // Hubstaff returns keyboard/mouse/overall as SECONDS, not percentages.
    const userActivity = new Map<number, { keyboard: number; mouse: number; overall: number; tracked: number }>();
    for (const block of activityBlocks) {
      if (!block.tracked || block.tracked <= 0) continue;
      if (!userActivity.has(block.user_id)) {
        userActivity.set(block.user_id, { keyboard: 0, mouse: 0, overall: 0, tracked: 0 });
      }
      const ua = userActivity.get(block.user_id)!;
      ua.keyboard += block.keyboard;
      ua.mouse += block.mouse;
      ua.overall += block.overall;
      ua.tracked += block.tracked;
    }

    // Get live sessions
    const liveSessions = await prisma.chatterSession.findMany({
      where: { isLive: true, source: "hubstaff" },
      select: { id: true, email: true, creatorId: true },
    });
    const liveSet = new Set(liveSessions.map(s => `${s.email}|${s.creatorId}`));
    const liveByEmail = new Map<string, string[]>();
    for (const s of liveSessions) {
      if (!liveByEmail.has(s.email)) liveByEmail.set(s.email, []);
      liveByEmail.get(s.email)!.push(s.id);
    }

    let clockedIn = 0;
    let clockedOut = 0;
    let activityUpdated = 0;
    const activeEmails = new Set<string>();

    for (const mapping of mappings) {
      const userId = parseInt(mapping.hubstaffUserId, 10);
      const isOnline = onlineUserIds.has(userId);

      if (isOnline) {
        activeEmails.add(mapping.chatterEmail);

        const creatorIds: string[] = [];
        if (mapping.creatorId) {
          creatorIds.push(mapping.creatorId);
        } else {
          const schedules = await prisma.chatterSchedule.findMany({
            where: { email: mapping.chatterEmail },
            select: { creatorId: true },
          });
          creatorIds.push(...[...new Set(schedules.map(s => s.creatorId))]);
        }

        // Convert summed seconds → percentage: (seconds / tracked) * 100
        const ua = userActivity.get(userId);
        const avgKeyboard = ua && ua.tracked > 0 ? Math.round((ua.keyboard / ua.tracked) * 100) : null;
        const avgMouse = ua && ua.tracked > 0 ? Math.round((ua.mouse / ua.tracked) * 100) : null;
        const avgOverall = ua && ua.tracked > 0 ? Math.round((ua.overall / ua.tracked) * 100) : null;

        for (const creatorId of creatorIds) {
          const key = `${mapping.chatterEmail}|${creatorId}`;
          if (liveSet.has(key)) {
            if (avgOverall !== null) {
              const sessionIds = liveByEmail.get(mapping.chatterEmail) || [];
              for (const sid of sessionIds) {
                await prisma.chatterSession.update({
                  where: { id: sid },
                  data: { keyboardPct: avgKeyboard, mousePct: avgMouse, overallActivity: avgOverall, activityUpdatedAt: now },
                });
                activityUpdated++;
              }
            }
            continue;
          }

          await prisma.chatterSession.create({
            data: {
              email: mapping.chatterEmail,
              creatorId,
              source: "hubstaff",
              keyboardPct: avgKeyboard,
              mousePct: avgMouse,
              overallActivity: avgOverall,
              activityUpdatedAt: avgOverall !== null ? now : undefined,
            },
          });
          clockedIn++;
        }
      }
    }

    // Clock out users no longer online
    for (const session of liveSessions) {
      if (!activeEmails.has(session.email)) {
        await prisma.chatterSession.update({
          where: { id: session.id },
          data: { isLive: false, clockOut: now },
        });
        clockedOut++;
      }
    }

    await updateLastSync();

    return NextResponse.json({
      status: "ok",
      clockedIn,
      clockedOut,
      activityUpdated,
      onlineUsers: onlineUserIds.size,
      activeUsers: activeEmails.size,
      totalMappings: mappings.length,
    });
  } catch (err: any) {
    console.error("Hubstaff sync-now error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrganizationActivities, getConfig, updateLastSync } from "@/lib/hubstaff";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/hubstaff-sync
 * Runs every 5 min. Syncs Hubstaff activity data → ChatterSession records.
 * Replaces manual clock-in for chatters who are tracked via Hubstaff.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const config = await getConfig();
    if (!config || !config.syncEnabled) {
      return NextResponse.json({ status: "sync_disabled" });
    }

    // Get all Hubstaff → chatter mappings
    const mappings = await prisma.hubstaffUserMapping.findMany();
    if (mappings.length === 0) {
      return NextResponse.json({ status: "no_mappings" });
    }

    // Fetch activities for the last 10 minutes
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const activities = await getOrganizationActivities(
      config.organizationId,
      tenMinAgo.toISOString(),
      now.toISOString()
    );

    // Group activities by user_id
    const activityByUser = new Map<number, boolean>();
    for (const act of activities) {
      if (act.tracked > 0) {
        activityByUser.set(act.user_id, true);
      }
    }

    // Get all currently live hubstaff sessions
    const liveSessions = await prisma.chatterSession.findMany({
      where: { isLive: true, source: "hubstaff" },
      select: { id: true, email: true, creatorId: true },
    });
    const liveSet = new Set(liveSessions.map(s => `${s.email}|${s.creatorId}`));

    let clockedIn = 0;
    let clockedOut = 0;
    const activeEmails = new Set<string>();

    // For each mapping, check if user has recent activity
    for (const mapping of mappings) {
      const userId = parseInt(mapping.hubstaffUserId, 10);
      const hasActivity = activityByUser.has(userId);

      if (hasActivity) {
        activeEmails.add(mapping.chatterEmail);

        // Get creator IDs: prefer direct mapping, fall back to schedule
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

        for (const creatorId of creatorIds) {
          const key = `${mapping.chatterEmail}|${creatorId}`;
          if (liveSet.has(key)) continue; // Already clocked in

          await prisma.chatterSession.create({
            data: {
              email: mapping.chatterEmail,
              creatorId,
              source: "hubstaff",
            },
          });
          clockedIn++;
        }
      }
    }

    // Clock out hubstaff sessions where user is no longer active
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

    console.log(`[Hubstaff Sync] In: ${clockedIn} | Out: ${clockedOut} | Active: ${activeEmails.size} | Mappings: ${mappings.length}`);

    return NextResponse.json({
      status: "ok",
      clockedIn,
      clockedOut,
      activeUsers: activeEmails.size,
      totalMappings: mappings.length,
    });
  } catch (err: any) {
    console.error("Hubstaff sync error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

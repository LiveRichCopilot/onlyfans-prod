import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLastActivities, getConfig, updateLastSync } from "@/lib/hubstaff";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/hubstaff-sync
 * Runs every 5 min. Uses Hubstaff last_activities endpoint to detect
 * who's online right now, then creates/closes ChatterSession records.
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

    // Use last_activities — shows who's online right now (simpler than activity windows)
    const lastActivities = await getLastActivities(config.organizationId);

    // Build set of online user IDs
    const onlineUserIds = new Set<number>();
    for (const act of lastActivities) {
      if (act.online) {
        onlineUserIds.add(act.user_id);
      }
    }

    // Get all currently live hubstaff sessions
    const now = new Date();
    const liveSessions = await prisma.chatterSession.findMany({
      where: { isLive: true, source: "hubstaff" },
      select: { id: true, email: true, creatorId: true },
    });
    const liveSet = new Set(liveSessions.map(s => `${s.email}|${s.creatorId}`));

    let clockedIn = 0;
    let clockedOut = 0;
    const activeEmails = new Set<string>();

    // For each mapping, check if user is online
    for (const mapping of mappings) {
      const userId = parseInt(mapping.hubstaffUserId, 10);
      const isOnline = onlineUserIds.has(userId);

      if (isOnline) {
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

    // Clock out hubstaff sessions where user is no longer online
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

    console.log(`[Hubstaff Sync] In: ${clockedIn} | Out: ${clockedOut} | Online: ${onlineUserIds.size} | Active: ${activeEmails.size} | Mappings: ${mappings.length}`);

    return NextResponse.json({
      status: "ok",
      clockedIn,
      clockedOut,
      onlineUsers: onlineUserIds.size,
      activeUsers: activeEmails.size,
      totalMappings: mappings.length,
    });
  } catch (err: any) {
    console.error("Hubstaff sync error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

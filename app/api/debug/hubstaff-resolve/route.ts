import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMembers, getActivities, getScreenshots, getToolUsages } from "@/lib/hubstaff";
import { resolveHubstaffUser } from "@/lib/hubstaff-resolve";

export const dynamic = "force-dynamic";

/** Debug: full pipeline test — resolve user → fetch activities → fetch screenshots */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") || "";
  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  try {
    // 1. DB profiles for this email
    const profiles = await prisma.chatterProfile.findMany({
      where: { chatterEmail: { contains: email, mode: "insensitive" } },
      select: { chatterEmail: true, chatterName: true, creatorId: true },
      take: 5,
    });

    // 2. Existing mappings
    const mappings = await prisma.hubstaffUserMapping.findMany({
      where: { chatterEmail: { contains: email, mode: "insensitive" } },
      select: { hubstaffUserId: true, hubstaffName: true, chatterEmail: true, creatorId: true },
    });

    // 3. All Hubstaff members
    const { members, users } = await listMembers();
    const hubstaffMembers = members.map((m: any) => {
      const u = users.find((u: any) => u.id === m.user_id);
      return {
        memberId: m.id,
        userId: m.user_id,
        name: u?.name || "unknown",
        email: u?.email || "unknown",
        status: u?.status || "unknown",
      };
    });

    // 4. Run resolveHubstaffUser
    const resolved = await resolveHubstaffUser(email);

    // 5. If resolved, fetch activities + screenshots for the date
    let activityData: any = null;
    let screenshotData: any = null;

    if (resolved) {
      const isoStart = `${targetDate}T00:00:00Z`;
      const isoEnd = `${targetDate}T23:59:59Z`;

      try {
        // Filter by user_id server-side to avoid pagination cutoff
        const userActivities = await getActivities(isoStart, isoEnd, resolved.hubstaffUserId);
        const totalTracked = userActivities.reduce((s, a) => s + a.tracked, 0);
        const totalOverall = userActivities.reduce((s, a) => s + a.overall, 0);

        activityData = {
          filteredByUserId: resolved.hubstaffUserId,
          userActivities: userActivities.length,
          totalTrackedSeconds: totalTracked,
          totalTrackedHrs: parseFloat((totalTracked / 3600).toFixed(2)),
          overallPct: totalTracked > 0 ? Math.round((totalOverall / totalTracked) * 100) : 0,
          sampleActivity: userActivities[0] || null,
        };
      } catch (e: any) {
        activityData = { error: e.message };
      }

      try {
        // Filter by user_id server-side to avoid pagination cutoff
        const userScreenshots = await getScreenshots(isoStart, isoEnd, resolved.hubstaffUserId);

        screenshotData = {
          filteredByUserId: resolved.hubstaffUserId,
          userScreenshots: userScreenshots.length,
          sampleScreenshot: userScreenshots[0] ? {
            id: userScreenshots[0].id,
            recorded_at: userScreenshots[0].recorded_at,
            user_id: userScreenshots[0].user_id,
          } : null,
        };
      } catch (e: any) {
        screenshotData = { error: e.message };
      }
    }

    // 6. Check sessions for this date
    const dayStart = new Date(`${targetDate}T00:00:00Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59Z`);
    const sessions = await prisma.chatterSession.findMany({
      where: {
        email: { contains: email, mode: "insensitive" },
        clockIn: { gte: dayStart, lte: dayEnd },
      },
      select: { email: true, clockIn: true, clockOut: true, creatorId: true },
      take: 10,
    });

    return NextResponse.json({
      searchEmail: email,
      targetDate,
      dbProfiles: profiles,
      existingMappings: mappings,
      resolved,
      hubstaffMemberCount: hubstaffMembers.length,
      hubstaffMembers,
      activityData,
      screenshotData,
      sessions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) }, { status: 500 });
  }
}

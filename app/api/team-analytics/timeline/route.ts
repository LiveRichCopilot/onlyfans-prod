import { NextRequest, NextResponse } from "next/server";
import { getActivities, listMembers } from "@/lib/hubstaff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/team-analytics/timeline?date=2026-02-27
 * Returns Hubstaff 10-min activity blocks grouped by member for a single day.
 */
export async function GET(req: NextRequest) {
  const dateParam =
    req.nextUrl.searchParams.get("date") ||
    new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  const dayStart = `${dateParam}T00:00:00Z`;
  const dayEnd = `${dateParam}T23:59:59Z`;

  try {
    const [activities, membersData, mappings] = await Promise.all([
      getActivities(dayStart, dayEnd),
      listMembers(),
      prisma.hubstaffUserMapping.findMany(),
    ]);

    // Lookup maps
    const userMap = new Map<number, any>();
    for (const u of (membersData.users || [])) userMap.set(u.id, u);

    const mappingByUserId = new Map<number, (typeof mappings)[0]>();
    for (const m of mappings) mappingByUserId.set(parseInt(m.hubstaffUserId, 10), m);

    // Group activities by user_id
    const actByUser = new Map<number, typeof activities>();
    for (const a of activities) {
      let arr = actByUser.get(a.user_id);
      if (!arr) { arr = []; actByUser.set(a.user_id, arr); }
      arr.push(a);
    }

    // Collect all unique user_ids (from members + any in activities)
    const allUserIds = new Set<number>();
    for (const m of (membersData.members || [])) allUserIds.add(m.user_id);
    for (const a of activities) allUserIds.add(a.user_id);

    const members = [...allUserIds].map(userId => {
      const user = userMap.get(userId);
      const mapping = mappingByUserId.get(userId);
      const userActs = actByUser.get(userId) || [];
      const totalTracked = userActs.reduce((s, a) => s + a.tracked, 0);

      return {
        userId,
        name: mapping?.hubstaffName || user?.name || `User ${userId}`,
        email: mapping?.chatterEmail || user?.email || "",
        totalTrackedSeconds: totalTracked,
        blocks: userActs.map(a => ({
          startsAt: a.starts_at,
          tracked: a.tracked,
          // Hubstaff returns seconds, convert to percentage
          activityPct: a.tracked > 0 ? Math.round((a.overall / a.tracked) * 100) : 0,
        })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      };
    }).sort((a, b) => b.totalTrackedSeconds - a.totalTrackedSeconds);

    return NextResponse.json({ date: dateParam, members });
  } catch (err: any) {
    console.error("[Timeline API]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

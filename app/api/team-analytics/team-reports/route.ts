import { NextRequest, NextResponse } from "next/server";
import { getTeams, getTeamMembers } from "@/lib/hubstaff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/team-analytics/team-reports?days=7
 * Returns Hubstaff teams with members, cross-referenced with scoring data.
 * Each member shows: name, email, whether they have recent reports, avg score, last scored time.
 */
export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Fetch teams and scoring data in parallel
    const [teams, mappings, profiles, recentScores] = await Promise.all([
      getTeams(),
      prisma.hubstaffUserMapping.findMany(),
      prisma.chatterProfile.findMany({
        include: { creator: { select: { name: true } } },
      }),
      prisma.chatterHourlyScore.findMany({
        where: { createdAt: { gte: since } },
        select: {
          chatterEmail: true,
          totalScore: true,
          windowStart: true,
          creatorId: true,
          creator: { select: { name: true } },
        },
        orderBy: { windowStart: "desc" },
      }),
    ]);

    // Build lookup maps
    const mappingByUserId = new Map<string, typeof mappings[0]>();
    for (const m of mappings) mappingByUserId.set(m.hubstaffUserId, m);

    // Group recent scores by email
    const scoresByEmail = new Map<string, {
      count: number;
      avgScore: number;
      lastScored: string;
      creators: Set<string>;
    }>();
    for (const s of recentScores) {
      const existing = scoresByEmail.get(s.chatterEmail);
      if (!existing) {
        scoresByEmail.set(s.chatterEmail, {
          count: 1,
          avgScore: s.totalScore,
          lastScored: s.windowStart.toISOString(),
          creators: new Set([s.creator.name || "Unknown"]),
        });
      } else {
        existing.count++;
        existing.avgScore = Math.round(
          (existing.avgScore * (existing.count - 1) + s.totalScore) / existing.count
        );
        existing.creators.add(s.creator.name || "Unknown");
      }
    }

    // Profile avg scores (lifetime)
    const profileByEmail = new Map<string, typeof profiles[0]>();
    for (const p of profiles) {
      const existing = profileByEmail.get(p.chatterEmail);
      if (!existing || p.totalScoringSessions > existing.totalScoringSessions) {
        profileByEmail.set(p.chatterEmail, p);
      }
    }

    // Exclude "Lucy" team (managers) — case-insensitive
    const chatterTeams = teams.filter(
      (t) => t.name.toLowerCase() !== "lucy"
    );

    // Fetch members for each team in parallel
    const teamResults = await Promise.all(
      chatterTeams.map(async (team) => {
        try {
          const { members, users } = await getTeamMembers(team.id);
          const userMap = new Map<number, any>();
          for (const u of users) userMap.set(u.id, u);

          const memberList = members.map((m) => {
            const user = userMap.get(m.user_id);
            const mapping = mappingByUserId.get(String(m.user_id));
            const email = mapping?.chatterEmail || user?.email || "";
            const name = mapping?.hubstaffName || user?.name || `User ${m.user_id}`;
            const scores = scoresByEmail.get(email);
            const profile = profileByEmail.get(email);

            return {
              userId: m.user_id,
              name,
              email,
              role: m.role,
              hasReports: (scores?.count || 0) > 0,
              reportsCount: scores?.count || 0,
              avgScore: scores?.avgScore || (profile ? Math.round(profile.avgTotalScore) : null),
              lifetimeAvg: profile ? Math.round(profile.avgTotalScore) : null,
              lifetimeSessions: profile?.totalScoringSessions || 0,
              lastScored: scores?.lastScored || null,
              creators: scores ? [...scores.creators] : [],
            };
          });

          // Sort: members with reports first, then by score descending
          memberList.sort((a, b) => {
            if (a.hasReports !== b.hasReports) return a.hasReports ? -1 : 1;
            return (b.avgScore || 0) - (a.avgScore || 0);
          });

          const scored = memberList.filter((m) => m.hasReports).length;
          const teamAvg = scored > 0
            ? Math.round(
                memberList
                  .filter((m) => m.hasReports)
                  .reduce((s, m) => s + (m.avgScore || 0), 0) / scored
              )
            : null;

          return {
            teamId: team.id,
            teamName: team.name,
            memberCount: memberList.length,
            scoredCount: scored,
            teamAvgScore: teamAvg,
            members: memberList,
          };
        } catch (err: any) {
          console.error(`[TeamReports] Failed to fetch team ${team.name}:`, err.message);
          return {
            teamId: team.id,
            teamName: team.name,
            memberCount: 0,
            scoredCount: 0,
            teamAvgScore: null,
            members: [],
          };
        }
      })
    );

    // Sort teams: teams with most scored members first
    teamResults.sort((a, b) => b.scoredCount - a.scoredCount || b.memberCount - a.memberCount);

    return NextResponse.json({
      teams: teamResults,
      totalMembers: teamResults.reduce((s, t) => s + t.memberCount, 0),
      totalScored: teamResults.reduce((s, t) => s + t.scoredCount, 0),
      days,
    });
  } catch (err: any) {
    console.error("[TeamReports API]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

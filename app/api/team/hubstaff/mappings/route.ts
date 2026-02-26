import { NextRequest, NextResponse } from "next/server";
import { listMembers } from "@/lib/hubstaff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/team/hubstaff/mappings
 *
 * Returns all Hubstaff members with their current chatter email mappings.
 * Also returns available chatter emails from ChatterSchedule for the mapping UI.
 */
export async function GET() {
  try {
    const [membersData, existingMappings, schedules, creators] = await Promise.all([
      listMembers(),
      prisma.hubstaffUserMapping.findMany(),
      prisma.chatterSchedule.findMany({
        select: { email: true, name: true },
        distinct: ["email"],
      }),
      prisma.creator.findMany({
        where: { active: true },
        select: { id: true, name: true, ofUsername: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const userMap = new Map<number, any>();
    for (const u of membersData.users) {
      userMap.set(u.id, u);
    }

    const mappingMap = new Map<string, any>();
    for (const m of existingMappings) {
      mappingMap.set(m.hubstaffUserId, m);
    }

    const members = membersData.members
      .filter((m) => m.membership_status === "active")
      .map((m) => {
        const user = userMap.get(m.user_id);
        const mapping = mappingMap.get(String(m.user_id));
        return {
          hubstaffUserId: String(m.user_id),
          name: user?.name || "Unknown",
          email: user?.email || "",
          role: m.membership_role,
          lastActive: m.last_client_activity,
          mapping: mapping
            ? {
                id: mapping.id,
                chatterEmail: mapping.chatterEmail,
                creatorId: mapping.creatorId,
              }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Unique chatter emails from schedules
    const chatterEmails = schedules.map((s) => ({
      email: s.email,
      name: s.name,
    }));

    return NextResponse.json({
      members,
      chatterEmails,
      creators,
      totalMapped: existingMappings.length,
      totalMembers: members.length,
    });
  } catch (e: any) {
    console.error("[Hubstaff Mappings GET]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/team/hubstaff/mappings
 *
 * Create or update a Hubstaff user → chatter email mapping.
 *
 * Body: { hubstaffUserId, hubstaffName, chatterEmail, creatorId? }
 *
 * Or bulk: { mappings: [{ hubstaffUserId, hubstaffName, chatterEmail, creatorId? }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle bulk mappings
    if (body.mappings && Array.isArray(body.mappings)) {
      const results = [];
      for (const m of body.mappings) {
        const result = await upsertMapping(m);
        results.push(result);
      }
      return NextResponse.json({ ok: true, mapped: results.length, results });
    }

    // Single mapping
    const result = await upsertMapping(body);
    return NextResponse.json({ ok: true, mapping: result });
  } catch (e: any) {
    console.error("[Hubstaff Mappings POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/team/hubstaff/mappings?hubstaffUserId=123
 *
 * Remove a mapping.
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const hubstaffUserId = url.searchParams.get("hubstaffUserId");

    if (!hubstaffUserId) {
      return NextResponse.json({ error: "hubstaffUserId required" }, { status: 400 });
    }

    await prisma.hubstaffUserMapping.deleteMany({
      where: { hubstaffUserId },
    });

    return NextResponse.json({ ok: true, deleted: hubstaffUserId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function upsertMapping(data: {
  hubstaffUserId: string;
  hubstaffName: string;
  chatterEmail: string;
  creatorId?: string;
}) {
  if (!data.hubstaffUserId || !data.chatterEmail) {
    throw new Error("hubstaffUserId and chatterEmail are required");
  }

  return prisma.hubstaffUserMapping.upsert({
    where: { hubstaffUserId: data.hubstaffUserId },
    create: {
      hubstaffUserId: data.hubstaffUserId,
      hubstaffName: data.hubstaffName || "Unknown",
      chatterEmail: data.chatterEmail,
      creatorId: data.creatorId || null,
    },
    update: {
      hubstaffName: data.hubstaffName || undefined,
      chatterEmail: data.chatterEmail,
      creatorId: data.creatorId || null,
    },
  });
}

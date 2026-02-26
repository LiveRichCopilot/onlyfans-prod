import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMembers } from "@/lib/hubstaff";

export const dynamic = "force-dynamic";

/**
 * GET /api/hubstaff/members
 * Returns Hubstaff org members for the mapping UI.
 * Uses listMembers (include=users) to get names/emails.
 */
export async function GET() {
  try {
    const config = await prisma.hubstaffConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: "Hubstaff not configured" }, { status: 400 });
    }

    const { members, users } = await listMembers();

    // Build user lookup from sideloaded users array
    const userMap = new Map<number, { name: string; email: string; status: string }>();
    for (const u of users) {
      userMap.set(u.id, { name: u.name || "Unknown", email: u.email || "", status: u.status || "unknown" });
    }

    // Also get existing mappings so the UI knows who's already mapped
    const mappings = await prisma.hubstaffUserMapping.findMany();
    const mappedIds = new Set(mappings.map(m => m.hubstaffUserId));

    const enriched = members.map((m: any) => {
      const user = userMap.get(m.user_id) || { name: "Unknown", email: "", status: "unknown" };
      return {
        hubstaffUserId: String(m.user_id),
        name: user.name,
        email: user.email,
        status: user.status,
        isMapped: mappedIds.has(String(m.user_id)),
      };
    });

    return NextResponse.json({ members: enriched });
  } catch (err: any) {
    console.error("Hubstaff members error:", err.message);
    return NextResponse.json({ members: [], error: err.message }, { status: 200 });
  }
}

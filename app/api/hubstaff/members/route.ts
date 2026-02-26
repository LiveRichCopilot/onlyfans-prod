import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrganizationMembers } from "@/lib/hubstaff";

export const dynamic = "force-dynamic";

/**
 * GET /api/hubstaff/members
 * Returns Hubstaff org members for the mapping UI.
 */
export async function GET() {
  try {
    const config = await prisma.hubstaffConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: "Hubstaff not configured" }, { status: 400 });
    }

    const members = await getOrganizationMembers(config.organizationId);

    // Also get existing mappings so the UI knows who's already mapped
    const mappings = await prisma.hubstaffUserMapping.findMany();
    const mappedIds = new Set(mappings.map(m => m.hubstaffUserId));

    const enriched = members.map(m => ({
      hubstaffUserId: String(m.user_id),
      name: m.user?.name || "Unknown",
      email: m.user?.email || "",
      status: m.user?.status || "unknown",
      isMapped: mappedIds.has(String(m.user_id)),
    }));

    return NextResponse.json({ members: enriched });
  } catch (err: any) {
    console.error("Hubstaff members error:", err.message);
    return NextResponse.json({ members: [], error: err.message }, { status: 200 });
  }
}

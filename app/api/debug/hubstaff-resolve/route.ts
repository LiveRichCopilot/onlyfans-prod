import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listMembers } from "@/lib/hubstaff";

export const dynamic = "force-dynamic";

/** Debug: check why a chatter isn't matching to Hubstaff */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") || "";

  try {
    // 1. What email do we have in DB?
    const profiles = await prisma.chatterProfile.findMany({
      where: { chatterName: { contains: "Elly", mode: "insensitive" } },
      select: { chatterEmail: true, chatterName: true, creatorId: true },
      take: 5,
    });

    // 2. What mappings exist?
    const mappings = await prisma.hubstaffUserMapping.findMany({
      select: { hubstaffUserId: true, hubstaffName: true, chatterEmail: true },
    });

    // 3. What does Hubstaff API return?
    const { members, users } = await listMembers();
    const hubstaffMembers = members.map(m => {
      const u = users.find((u: any) => u.id === m.user_id);
      return {
        memberId: m.id,
        userId: m.user_id,
        name: u?.name || "unknown",
        email: u?.email || "unknown",
        status: u?.status || "unknown",
      };
    });

    // 4. Try matching the requested email
    const emailNorm = email.toLowerCase().trim();
    const emailMatch = hubstaffMembers.find(m => m.email.toLowerCase().trim() === emailNorm);

    // 5. Try name match
    const profile = profiles.find(p => p.chatterEmail.toLowerCase() === emailNorm) || profiles[0];
    const chatterName = (profile?.chatterName || email.split("@")[0]).toLowerCase().trim();
    const nameMatch = hubstaffMembers.find(m => {
      const hsName = m.name.toLowerCase().trim();
      if (hsName === chatterName) return true;
      const hsParts = hsName.split(/\s+/);
      const chParts = chatterName.split(/\s+/);
      return (hsParts.every((p: string) => chatterName.includes(p)) || chParts.every((p: string) => hsName.includes(p))) && hsParts.length >= 2;
    });

    return NextResponse.json({
      searchEmail: email,
      dbProfiles: profiles,
      existingMappings: mappings,
      hubstaffMembers,
      matching: {
        emailMatch: emailMatch || null,
        nameMatch: nameMatch || null,
        chatterNameUsed: chatterName,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

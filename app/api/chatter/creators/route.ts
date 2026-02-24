import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");

    // If email provided, return only creators this chatter is assigned to
    if (email) {
      const assignments = await prisma.chatterSchedule.findMany({
        where: { email: email.toLowerCase().trim() },
        select: {
          creatorId: true,
          shift: true,
          isCover: true,
          name: true,
          creator: { select: { id: true, name: true } },
        },
        orderBy: { creator: { name: "asc" } },
      });

      if (assignments.length > 0) {
        // Deduplicate creators (same creator may appear across shifts)
        const seen = new Set<string>();
        const creators = assignments
          .filter((a) => {
            if (seen.has(a.creatorId)) return false;
            seen.add(a.creatorId);
            return true;
          })
          .map((a) => a.creator);

        return NextResponse.json({
          creators,
          chatterName: assignments[0].name,
          shift: assignments[0].shift,
          isCover: assignments[0].isCover,
        });
      }

      // Email not in schedule — return empty (they can't clock in)
      return NextResponse.json({ creators: [], chatterName: null, shift: null, isCover: false });
    }

    // No email — return all active creators (admin/fallback)
    const creators = await prisma.creator.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(creators);
  } catch (error) {
    console.error("Failed to fetch creators:", error);
    return NextResponse.json(
      { error: "Failed to fetch creators" },
      { status: 500 }
    );
  }
}

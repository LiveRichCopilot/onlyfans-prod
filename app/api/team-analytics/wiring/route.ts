import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Wiring API — each creator with their ONE active chatter right now. */
export async function GET() {
  try {
    const now = new Date();

    const [creators, liveSessions, overrides, scheduleNames] = await Promise.all([
      prisma.creator.findMany({
        where: { active: true },
        select: { id: true, name: true, ofUsername: true, avatarUrl: true },
        orderBy: { name: "asc" },
      }),
      prisma.chatterSession.findMany({
        where: { isLive: true },
        select: { email: true, creatorId: true, clockIn: true, source: true },
        orderBy: { clockIn: "desc" },
      }),
      prisma.assignmentOverride.findMany({
        where: { startAt: { lte: now }, endAt: { gt: now } },
        select: { creatorId: true, chatterEmail: true, endAt: true, reason: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.chatterSchedule.findMany({
        select: { email: true, name: true },
        distinct: ["email"],
      }),
    ]);

    const nameMap = new Map<string, string>();
    for (const s of scheduleNames) nameMap.set(s.email, s.name);

    // One override per creator (first wins — newest)
    const ovrMap = new Map<string, typeof overrides[0]>();
    for (const o of overrides) if (!ovrMap.has(o.creatorId)) ovrMap.set(o.creatorId, o);

    // One live session per creator (first wins — most recent clockIn)
    const liveMap = new Map<string, typeof liveSessions[0]>();
    for (const s of liveSessions) if (!liveMap.has(s.creatorId)) liveMap.set(s.creatorId, s);

    const nodes = creators.map(c => {
      const ovr = ovrMap.get(c.id);
      const live = liveMap.get(c.id);

      if (ovr) {
        const mins = Math.round((ovr.endAt.getTime() - now.getTime()) / 60000);
        return {
          ...c,
          chatter: {
            email: ovr.chatterEmail,
            name: nameMap.get(ovr.chatterEmail) || ovr.chatterEmail.split("@")[0],
            source: "override" as const,
            detail: `${mins}m left${ovr.reason ? ` · ${ovr.reason}` : ""}`,
          },
        };
      }

      if (live) {
        const mins = Math.round((now.getTime() - live.clockIn.getTime()) / 60000);
        return {
          ...c,
          chatter: {
            email: live.email,
            name: nameMap.get(live.email) || live.email.split("@")[0],
            source: "live" as const,
            detail: `${mins}m in`,
          },
        };
      }

      return { ...c, chatter: null };
    });

    return NextResponse.json({ nodes });
  } catch (err: any) {
    console.error("[wiring] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

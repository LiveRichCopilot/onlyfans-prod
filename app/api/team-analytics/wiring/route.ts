import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Wiring API — each creator with ALL active chatters right now. */
export async function GET() {
  try {
    const now = new Date();

    const [creators, liveSessions, overrides, scheduleNames, employees, hubstaffMappings] = await Promise.all([
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
      prisma.user.findMany({
        where: { role: "EMPLOYEE" },
        select: { email: true, name: true },
      }),
      prisma.hubstaffUserMapping.findMany({
        select: { chatterEmail: true, hubstaffName: true },
        distinct: ["chatterEmail"],
      }),
    ]);

    const nameMap = new Map<string, string>();
    for (const h of hubstaffMappings) {
      if (h.hubstaffName) nameMap.set(h.chatterEmail, h.hubstaffName);
    }
    for (const e of employees) {
      if (e.email && e.name) nameMap.set(e.email, e.name);
    }
    for (const s of scheduleNames) nameMap.set(s.email, s.name);

    // Group overrides by creator
    const ovrByCreator = new Map<string, typeof overrides>();
    for (const o of overrides) {
      const arr = ovrByCreator.get(o.creatorId) || [];
      arr.push(o);
      ovrByCreator.set(o.creatorId, arr);
    }

    // Group live sessions by creator
    const liveByCreator = new Map<string, typeof liveSessions>();
    for (const s of liveSessions) {
      const arr = liveByCreator.get(s.creatorId) || [];
      arr.push(s);
      liveByCreator.set(s.creatorId, arr);
    }

    type Chatter = { email: string; name: string; source: "override" | "live"; detail: string };

    const nodes = creators.map(c => {
      const chatters: Chatter[] = [];
      const seen = new Set<string>();

      // Overrides first (highest priority)
      for (const o of ovrByCreator.get(c.id) || []) {
        if (!seen.has(o.chatterEmail)) {
          seen.add(o.chatterEmail);
          const mins = Math.round((o.endAt.getTime() - now.getTime()) / 60000);
          chatters.push({
            email: o.chatterEmail,
            name: nameMap.get(o.chatterEmail) || o.chatterEmail.split("@")[0],
            source: "override",
            detail: `${mins}m left${o.reason ? ` · ${o.reason}` : ""}`,
          });
        }
      }

      // Live sessions (skip if already overridden)
      for (const s of liveByCreator.get(c.id) || []) {
        if (!seen.has(s.email)) {
          seen.add(s.email);
          const mins = Math.round((now.getTime() - s.clockIn.getTime()) / 60000);
          chatters.push({
            email: s.email,
            name: nameMap.get(s.email) || s.email.split("@")[0],
            source: "live",
            detail: `${mins}m in`,
          });
        }
      }

      return { ...c, chatters };
    });

    // ALL employees — merge User(EMPLOYEE) + ChatterSchedule + HubstaffUserMapping
    const chatterMap = new Map<string, string>();
    for (const h of hubstaffMappings) {
      chatterMap.set(h.chatterEmail, h.hubstaffName || h.chatterEmail.split("@")[0]);
    }
    for (const e of employees) {
      if (e.email) chatterMap.set(e.email, e.name || e.email.split("@")[0]);
    }
    for (const s of scheduleNames) {
      chatterMap.set(s.email, s.name);
    }
    const allChatters = Array.from(chatterMap.entries())
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ nodes, allChatters });
  } catch (err: any) {
    console.error("[wiring] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Wiring API — all data for the Creator ↔ Chatter visual panel. */
export async function GET() {
  try {
    const now = new Date();

    const [creators, liveSessions, schedules, overrides] = await Promise.all([
      prisma.creator.findMany({
        where: { active: true },
        select: { id: true, name: true, ofUsername: true, avatarUrl: true },
        orderBy: { name: "asc" },
      }),
      prisma.chatterSession.findMany({
        where: { isLive: true },
        select: { id: true, email: true, creatorId: true, clockIn: true, source: true, overallActivity: true },
        orderBy: { clockIn: "desc" },
      }),
      prisma.chatterSchedule.findMany({
        select: { id: true, email: true, name: true, shift: true, creatorId: true, isCover: true },
        orderBy: { name: "asc" },
      }),
      prisma.assignmentOverride.findMany({
        where: { endAt: { gt: now } },
        select: { id: true, creatorId: true, chatterEmail: true, startAt: true, endAt: true, reason: true },
        orderBy: { startAt: "desc" },
      }),
    ]);

    // Unique chatters from schedules + live
    const chatterMap = new Map<string, { email: string; name: string }>();
    for (const s of schedules) {
      if (!chatterMap.has(s.email)) chatterMap.set(s.email, { email: s.email, name: s.name });
    }
    for (const s of liveSessions) {
      if (!chatterMap.has(s.email)) chatterMap.set(s.email, { email: s.email, name: s.email.split("@")[0] });
    }

    // Build connections with priority: override > live > scheduled
    const connections: { chatterEmail: string; creatorId: string; source: string; detail?: string }[] = [];
    const seen = new Set<string>();

    for (const o of overrides) {
      if (o.startAt <= now && o.endAt > now) {
        const key = `${o.chatterEmail}::${o.creatorId}`;
        seen.add(key);
        const mins = Math.round((o.endAt.getTime() - now.getTime()) / 60000);
        connections.push({ chatterEmail: o.chatterEmail, creatorId: o.creatorId, source: "override", detail: `${mins}m left${o.reason ? ` (${o.reason})` : ""}` });
      }
    }
    for (const s of liveSessions) {
      const key = `${s.email}::${s.creatorId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const mins = Math.round((now.getTime() - s.clockIn.getTime()) / 60000);
        connections.push({ chatterEmail: s.email, creatorId: s.creatorId, source: "live", detail: `${mins}m in (${s.source})` });
      }
    }
    for (const s of schedules) {
      const key = `${s.email}::${s.creatorId}`;
      if (!seen.has(key)) {
        connections.push({ chatterEmail: s.email, creatorId: s.creatorId, source: "scheduled", detail: `shift: ${s.shift}` });
      }
    }

    return NextResponse.json({
      creators,
      chatters: [...chatterMap.values()],
      connections,
      overrides: overrides.map((o: { id: string; creatorId: string; chatterEmail: string; startAt: Date; endAt: Date; reason: string | null }) => ({
        id: o.id, creatorId: o.creatorId, chatterEmail: o.chatterEmail,
        startAt: o.startAt.toISOString(), endAt: o.endAt.toISOString(),
        reason: o.reason, isActive: o.startAt <= now && o.endAt > now,
      })),
    });
  } catch (err: any) {
    console.error("[wiring] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

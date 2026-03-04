import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEmail, normalizeEmail } from "@/lib/resolve-chatter-email";

export const dynamic = "force-dynamic";

/** Wiring API — each creator with ALL active chatters right now. */
export async function GET() {
  try {
    const now = new Date();

    // Compute current UK day-of-week and shift type for schedule lookup
    const ukNow = new Date(now.toLocaleString("en-GB", { timeZone: "Europe/London" }));
    const ukDow = ukNow.getDay();
    const ukHour = ukNow.getHours();
    const currentShiftType = ukHour >= 7 && ukHour < 15 ? "morning" : ukHour >= 15 && ukHour < 23 ? "afternoon" : "night";

    const [creators, liveSessions, overrides, scheduleShifts, hubstaffMappings] = await Promise.all([
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
        select: { id: true, creatorId: true, chatterEmail: true, endAt: true, reason: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.scheduleShift.findMany({
        select: { chatterEmail: true, chatterName: true, creatorId: true, shiftType: true },
        distinct: ["creatorId", "chatterEmail", "shiftType"],
      }),
      prisma.hubstaffUserMapping.findMany({
        select: { chatterEmail: true, hubstaffName: true },
        distinct: ["chatterEmail"],
      }),
    ]);

    // Name lookup — Hubstaff is source of truth for chatter names
    const nameMap = new Map<string, string>();
    for (const h of hubstaffMappings) {
      if (h.hubstaffName) {
        nameMap.set(normalizeEmail(h.chatterEmail), h.hubstaffName);
      }
    }

    // Group overrides by creator
    const ovrByCreator = new Map<string, typeof overrides>();
    for (const o of overrides) {
      const arr = ovrByCreator.get(o.creatorId) || [];
      arr.push(o);
      ovrByCreator.set(o.creatorId, arr);
    }

    // Group ScheduleShift entries by creator (source of truth)
    const shiftByCreator = new Map<string, typeof scheduleShifts>();
    for (const s of scheduleShifts) {
      const arr = shiftByCreator.get(s.creatorId) || [];
      arr.push(s);
      shiftByCreator.set(s.creatorId, arr);
    }

    type Chatter = { email: string; name: string; source: "override" | "live" | "assigned"; detail: string; overrideId?: string; isLive: boolean };

    // Pre-resolve all emails through alias table so dedup works across email mismatches
    const allRawEmails = new Set<string>();
    overrides.forEach(o => allRawEmails.add(normalizeEmail(o.chatterEmail)));
    liveSessions.forEach(s => allRawEmails.add(normalizeEmail(s.email)));
    scheduleShifts.forEach(s => allRawEmails.add(normalizeEmail(s.chatterEmail)));
    hubstaffMappings.forEach(h => allRawEmails.add(normalizeEmail(h.chatterEmail)));
    const resolvedMap = new Map<string, string>();
    for (const email of allRawEmails) {
      if (!email) continue;
      resolvedMap.set(email, await resolveEmail(email));
    }
    const re = (email: string) => resolvedMap.get(normalizeEmail(email)) || normalizeEmail(email);

    // Per-creator live emails (who's clocked in on THIS model's Hubstaff project)
    const livePerCreator = new Map<string, Set<string>>();
    // Global live emails (clocked in anywhere — matches schedule page green dots)
    const liveAnywhere = new Set<string>();
    for (const s of liveSessions) {
      const resolved = re(s.email);
      if (!resolved) continue;
      liveAnywhere.add(resolved);
      if (!livePerCreator.has(s.creatorId)) livePerCreator.set(s.creatorId, new Set());
      livePerCreator.get(s.creatorId)!.add(resolved);
    }

    const nodes = creators.map(c => {
      const chatters: Chatter[] = [];
      const seen = new Set<string>();

      // Overrides first (highest priority)
      for (const o of ovrByCreator.get(c.id) || []) {
        const resolved = re(o.chatterEmail);
        if (!resolved || seen.has(resolved)) continue;
        seen.add(resolved);
        const mins = Math.round((o.endAt.getTime() - now.getTime()) / 60000);
        chatters.push({
          email: resolved,
          name: nameMap.get(resolved) || nameMap.get(o.chatterEmail) || resolved.split("@")[0],
          source: "override",
          detail: `${mins}m left${o.reason ? ` · ${o.reason}` : ""}`,
          overrideId: o.id,
          isLive: liveAnywhere.has(resolved),
        });
      }

      // Schedule shifts (recurring template — skip if already overridden)
      for (const s of shiftByCreator.get(c.id) || []) {
        const resolved = re(s.chatterEmail);
        if (!resolved || seen.has(resolved)) continue;
        seen.add(resolved);
        const shiftLabel = s.shiftType === "morning" ? "AM 07–15" : s.shiftType === "afternoon" ? "PM 15–23" : "Night 23–07";
        chatters.push({
          email: resolved,
          name: nameMap.get(resolved) || s.chatterName || resolved.split("@")[0],
          source: "assigned",
          detail: shiftLabel,
          isLive: liveAnywhere.has(resolved),
        });
      }

      return { ...c, chatters };
    });

    // ALL chatters — Hubstaff is the single source of truth
    const chatterMap = new Map<string, { email: string; name: string }>();
    for (const h of hubstaffMappings) {
      const key = re(h.chatterEmail);
      if (!chatterMap.has(key)) {
        chatterMap.set(key, { email: key, name: h.hubstaffName || key.split("@")[0] });
      }
    }
    const allChatters = Array.from(chatterMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ nodes, allChatters });
  } catch (err: any) {
    console.error("[wiring] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

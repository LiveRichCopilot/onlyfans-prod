import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEmail, normalizeEmail } from "@/lib/resolve-chatter-email";

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
        select: { id: true, creatorId: true, chatterEmail: true, endAt: true, reason: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.chatterSchedule.findMany({
        select: { email: true, name: true, creatorId: true, shift: true },
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
      if (h.hubstaffName) {
        nameMap.set(normalizeEmail(h.chatterEmail), h.hubstaffName);
      }
    }
    for (const e of employees) {
      if (e.email && e.name) nameMap.set(normalizeEmail(e.email), e.name);
    }
    for (const s of scheduleNames) nameMap.set(normalizeEmail(s.email), s.name);

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

    // Group schedule entries by creator
    const schedByCreator = new Map<string, typeof scheduleNames>();
    for (const s of scheduleNames) {
      const arr = schedByCreator.get(s.creatorId) || [];
      arr.push(s);
      schedByCreator.set(s.creatorId, arr);
    }

    type Chatter = { email: string; name: string; source: "override" | "live" | "assigned"; detail: string; overrideId?: string };

    // Pre-resolve all emails through alias table so dedup works across email mismatches
    const allRawEmails = new Set<string>();
    overrides.forEach(o => allRawEmails.add(normalizeEmail(o.chatterEmail)));
    liveSessions.forEach(s => allRawEmails.add(normalizeEmail(s.email)));
    scheduleNames.forEach(s => allRawEmails.add(normalizeEmail(s.email)));
    hubstaffMappings.forEach(h => allRawEmails.add(normalizeEmail(h.chatterEmail)));
    employees.forEach(e => e.email && allRawEmails.add(normalizeEmail(e.email)));
    const resolvedMap = new Map<string, string>();
    for (const email of allRawEmails) {
      if (!email) continue;
      resolvedMap.set(email, await resolveEmail(email));
    }
    const re = (email: string) => resolvedMap.get(normalizeEmail(email)) || normalizeEmail(email);

    const nodes = creators.map(c => {
      const chatters: Chatter[] = [];
      const seen = new Set<string>(); // uses resolved emails for dedup

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
        });
      }

      // Live sessions (skip if already overridden)
      for (const s of liveByCreator.get(c.id) || []) {
        const resolved = re(s.email);
        if (!resolved || seen.has(resolved)) continue;
        seen.add(resolved);
        const mins = Math.round((now.getTime() - s.clockIn.getTime()) / 60000);
        chatters.push({
          email: resolved,
          name: nameMap.get(resolved) || nameMap.get(s.email) || resolved.split("@")[0],
          source: "live",
          detail: `${mins}m in`,
        });
      }

      // Assigned from schedule (not live, not overridden — show as assigned)
      for (const s of schedByCreator.get(c.id) || []) {
        const resolved = re(s.email);
        if (!resolved || seen.has(resolved)) continue;
        seen.add(resolved);
        chatters.push({
          email: resolved,
          name: nameMap.get(resolved) || nameMap.get(s.email) || resolved.split("@")[0],
          source: "assigned",
          detail: s.shift === "default" ? "assigned" : s.shift,
        });
      }

      return { ...c, chatters };
    });

    // ALL employees — HubstaffUserMapping is source of truth, then fill gaps from schedule/employees
    // Dedupe by resolved email AND by name (same person, different emails = one entry)
    const chatterMap = new Map<string, { email: string; name: string }>();
    const seenNames = new Map<string, string>(); // lowercase name → email key (first wins)

    // Hubstaff mappings first (source of truth)
    for (const h of hubstaffMappings) {
      const key = re(h.chatterEmail);
      const name = h.hubstaffName || key.split("@")[0];
      chatterMap.set(key, { email: key, name });
      seenNames.set(name.toLowerCase(), key);
    }
    // Employees — skip if name already seen
    for (const e of employees) {
      if (e.email) {
        const key = re(e.email);
        const name = e.name || key.split("@")[0];
        if (!chatterMap.has(key) && !seenNames.has(name.toLowerCase())) {
          chatterMap.set(key, { email: key, name });
          seenNames.set(name.toLowerCase(), key);
        }
      }
    }
    // Schedule — skip if name already seen
    for (const s of scheduleNames) {
      const key = re(s.email);
      if (!chatterMap.has(key) && !seenNames.has(s.name.toLowerCase())) {
        chatterMap.set(key, { email: key, name: s.name });
        seenNames.set(s.name.toLowerCase(), key);
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEmail, normalizeEmail } from "@/lib/resolve-chatter-email";

export const dynamic = "force-dynamic";

/** Wiring API — each creator with ALL active chatters right now. */
export async function GET() {
  try {
    const now = new Date();

    const [creators, liveSessions, overrides, scheduleNames, hubstaffMappings] = await Promise.all([
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
      prisma.hubstaffUserMapping.findMany({
        select: { chatterEmail: true, hubstaffName: true },
        distinct: ["chatterEmail"],
      }),
    ]);

    // Name lookup — schedule names first, then Hubstaff overwrites (Hubstaff wins)
    const nameMap = new Map<string, string>();
    for (const s of scheduleNames) nameMap.set(normalizeEmail(s.email), s.name);
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

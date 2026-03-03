import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Debug: show where the gaps are between Hubstaff mappings, schedules, and live sessions */
export async function GET() {
  try {
    const [mappings, schedules, liveSessions, creators] = await Promise.all([
      prisma.hubstaffUserMapping.findMany({
        select: { hubstaffUserId: true, hubstaffName: true, chatterEmail: true, creatorId: true },
      }),
      prisma.chatterSchedule.findMany({
        select: { email: true, name: true, creatorId: true, shift: true },
      }),
      prisma.chatterSession.findMany({
        where: { isLive: true },
        select: { email: true, creatorId: true, clockIn: true, source: true },
      }),
      prisma.creator.findMany({
        where: { active: true },
        select: { id: true, name: true },
      }),
    ]);

    const creatorMap = new Map(creators.map(c => [c.id, c.name || c.id]));

    // Build per-chatter report
    const allEmails = new Set<string>();
    mappings.forEach(m => m.chatterEmail && allEmails.add(m.chatterEmail.toLowerCase()));
    schedules.forEach(s => s.email && allEmails.add(s.email.toLowerCase()));
    liveSessions.forEach(s => s.email && allEmails.add(s.email.toLowerCase()));

    const report = Array.from(allEmails).sort().map(email => {
      const mapping = mappings.filter(m => m.chatterEmail.toLowerCase() === email);
      const sched = schedules.filter(s => s.email.toLowerCase() === email);
      const live = liveSessions.filter(s => s.email.toLowerCase() === email);

      const hasMapping = mapping.length > 0;
      const mappingHasCreator = mapping.some(m => !!m.creatorId);
      const hasSchedule = sched.length > 0;
      const isLive = live.length > 0;

      // Identify the gap
      let status = "OK";
      if (!hasMapping) status = "NO_HUBSTAFF_MAPPING";
      else if (!mappingHasCreator && !hasSchedule) status = "NO_CREATOR_ID";
      else if (!isLive) status = "MAPPED_BUT_NOT_LIVE";
      else status = "LIVE";

      return {
        email,
        name: mapping[0]?.hubstaffName || sched[0]?.name || email.split("@")[0],
        status,
        hubstaffMapping: mapping.map(m => ({
          hubstaffUserId: m.hubstaffUserId,
          creatorId: m.creatorId,
          creatorName: creatorMap.get(m.creatorId) || null,
        })),
        scheduleEntries: sched.map(s => ({
          creatorId: s.creatorId,
          creatorName: creatorMap.get(s.creatorId) || null,
          shift: s.shift,
        })),
        liveSessions: live.map(s => ({
          creatorId: s.creatorId,
          creatorName: creatorMap.get(s.creatorId) || null,
          source: s.source,
          clockIn: s.clockIn.toISOString(),
        })),
      };
    });

    const summary = {
      total: report.length,
      live: report.filter(r => r.status === "LIVE").length,
      mappedNotLive: report.filter(r => r.status === "MAPPED_BUT_NOT_LIVE").length,
      noCreatorId: report.filter(r => r.status === "NO_CREATOR_ID").length,
      noMapping: report.filter(r => r.status === "NO_HUBSTAFF_MAPPING").length,
    };

    return NextResponse.json({ summary, chatters: report });
  } catch (err: any) {
    console.error("[wiring-debug] error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

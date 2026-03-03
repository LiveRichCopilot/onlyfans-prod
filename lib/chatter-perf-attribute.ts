import { prisma } from "@/lib/prisma";
import { getActiveChatterBatch } from "@/lib/chatter-attribution";
import type { RawMessage, CreatorEarnings } from "./chatter-perf-fetch";

/** Mutable stats accumulator per chatter */
export type ChatterStats = {
  email: string;
  name: string;
  creators: Set<string>;
  ppvSales: number;
  directMsgSales: number;
  massSales: number;
  dmsSent: number;
  directPpvsSent: number;
  ppvsUnlocked: number;
  charCount: number;
  spenderCount: number;
  clockedSeconds: number;
  overrideHours: number;
  hubstaffHours: number;
  unassignedHours: number;
};

type SessionRow = {
  email: string;
  creatorId: string;
  clockIn: Date;
  clockOut: Date | null;
};

type ScheduleInfo = { name: string; shift: string };

export type AttributeResult = {
  chatterMap: Map<string, ChatterStats>;
  sessions: SessionRow[];
  scheduleMap: Map<string, ScheduleInfo>;
  tipShares: Map<string, number>;
};

/** Load sessions + schedules from DB */
export async function loadSessionData(
  startDate: Date,
  endDate: Date,
  creatorId: string | null,
) {
  const sessionWhere: Record<string, unknown> = {
    clockIn: { lte: endDate },
    OR: [{ clockOut: { gte: startDate } }, { clockOut: null, isLive: true }],
  };
  if (creatorId) sessionWhere.creatorId = creatorId;

  const sessions = await prisma.chatterSession.findMany({
    where: sessionWhere,
    select: { email: true, creatorId: true, clockIn: true, clockOut: true },
  });

  const scheduleWhere: Record<string, unknown> = {};
  if (creatorId) scheduleWhere.creatorId = creatorId;

  const schedules = await prisma.chatterSchedule.findMany({
    where: scheduleWhere,
    select: { email: true, name: true, creatorId: true, shift: true },
  });

  const scheduleMap = new Map<string, ScheduleInfo>();
  for (const s of schedules) {
    scheduleMap.set(s.email, { name: s.name, shift: s.shift });
  }

  return { sessions, scheduleMap };
}

/** Attribute messages + sessions to chatters using override → hubstaff → unassigned */
export async function attributeToChatter(
  messages: RawMessage[],
  creatorEarnings: Map<string, CreatorEarnings>,
  creators: { id: string; name: string | null }[],
  sessions: SessionRow[],
  scheduleMap: Map<string, ScheduleInfo>,
  startDate: Date,
  endDate: Date,
): Promise<AttributeResult> {
  // Build attribution resolvers per creator (batch — avoids N+1)
  const uniqueCreatorIds = [...new Set([
    ...messages.map(m => m.creatorId),
    ...sessions.map(s => s.creatorId),
  ])];

  const resolvers = new Map<string, Awaited<ReturnType<typeof getActiveChatterBatch>>>();
  await Promise.all(uniqueCreatorIds.map(async (cId) => {
    const r = await getActiveChatterBatch(cId, startDate, endDate);
    resolvers.set(cId, r);
  }));

  const chatterMap = new Map<string, ChatterStats>();
  const creatorNameMap = new Map(creators.map(c => [c.id, c.name || "Unknown"]));

  function getOrCreate(email: string): ChatterStats {
    if (!chatterMap.has(email)) {
      const sched = scheduleMap.get(email);
      chatterMap.set(email, {
        email,
        name: sched?.name || email.split("@")[0],
        creators: new Set(),
        ppvSales: 0, directMsgSales: 0, massSales: 0,
        dmsSent: 0, directPpvsSent: 0, ppvsUnlocked: 0,
        charCount: 0, spenderCount: 0, clockedSeconds: 0,
        overrideHours: 0, hubstaffHours: 0, unassignedHours: 0,
      });
    }
    return chatterMap.get(email)!;
  }

  // Attribute messages
  for (const msg of messages) {
    if (!msg.date) continue;
    const resolver = resolvers.get(msg.creatorId);
    if (!resolver) continue;

    const attr = resolver.resolve(new Date(msg.date));
    if (!attr.email) continue;

    const stats = getOrCreate(attr.email);
    stats.creators.add(creatorNameMap.get(msg.creatorId) || "Unknown");

    if (msg.source === "direct") {
      stats.dmsSent += 1;
      stats.charCount += msg.text.length;
      if (msg.price > 0) stats.directPpvsSent += 1;
    }

    if (msg.purchasedCount > 0) {
      stats.ppvsUnlocked += msg.purchasedCount;
      const revenue = msg.purchasedCount * msg.price;
      if (msg.source === "direct") {
        stats.directMsgSales += revenue;
        stats.ppvSales += revenue;
      } else {
        stats.massSales += revenue;
      }
      stats.spenderCount += 1;
    }
  }

  // Attribute session hours
  const hoursPerCreatorChatter = new Map<string, Map<string, number>>();

  for (const s of sessions) {
    const sessionStart = Math.max(s.clockIn.getTime(), startDate.getTime());
    const sessionEnd = Math.min(
      s.clockOut ? s.clockOut.getTime() : Date.now(),
      endDate.getTime(),
    );
    const hours = Math.max(0, (sessionEnd - sessionStart) / 3600000);
    const seconds = Math.max(0, (sessionEnd - sessionStart) / 1000);

    const midpoint = new Date(sessionStart + (sessionEnd - sessionStart) / 2);
    const resolver = resolvers.get(s.creatorId);
    const source = resolver ? resolver.resolve(midpoint).source : "hubstaff";

    const stats = getOrCreate(s.email);
    stats.creators.add(creatorNameMap.get(s.creatorId) || "Unknown");
    stats.clockedSeconds += seconds;

    if (source === "override") stats.overrideHours += hours;
    else if (source === "hubstaff") stats.hubstaffHours += hours;
    else stats.unassignedHours += hours;

    // Track hours per creator per chatter for tip distribution
    if (!hoursPerCreatorChatter.has(s.creatorId)) {
      hoursPerCreatorChatter.set(s.creatorId, new Map());
    }
    const m = hoursPerCreatorChatter.get(s.creatorId)!;
    m.set(s.email, (m.get(s.email) || 0) + hours);
  }

  // Distribute tips proportionally by clocked hours
  const tipShares = new Map<string, number>();
  for (const [cId, emailMap] of hoursPerCreatorChatter) {
    const earnings = creatorEarnings.get(cId);
    if (!earnings?.tips) continue;
    const totalHrs = [...emailMap.values()].reduce((a, b) => a + b, 0);
    if (totalHrs <= 0) continue;

    for (const [email, hrs] of emailMap) {
      const share = earnings.tips * (hrs / totalHrs);
      tipShares.set(email, (tipShares.get(email) || 0) + share);
    }
  }

  return { chatterMap, sessions, scheduleMap, tipShares };
}

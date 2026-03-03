import { prisma } from "@/lib/prisma";
import { getActiveChatterBatch } from "@/lib/chatter-attribution";
import type { TransactionRow } from "./chatter-perf-fetch";
import { isAttributable } from "./chatter-perf-fetch";

/** Mutable stats accumulator per chatter */
export type ChatterStats = {
  email: string;
  name: string;
  creators: Set<string>;
  // Revenue by transaction type (from DB — real dollars)
  messageSales: number;
  tipSales: number;
  postSales: number;
  // Activity counts from transactions
  txCount: number;
  messageTxCount: number;
  uniqueFans: Set<string>;
  // Hours
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
};

export type ShiftEntry = {
  chatterEmail: string;
  chatterName: string | null;
  creatorId: string;
  shiftType: string;
};

/** Load sessions + schedules + schedule shifts from DB */
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

  const shiftWhere: Record<string, unknown> = {};
  if (creatorId) shiftWhere.creatorId = creatorId;

  const [sessions, schedules, scheduleShifts] = await Promise.all([
    prisma.chatterSession.findMany({
      where: sessionWhere,
      select: { email: true, creatorId: true, clockIn: true, clockOut: true },
    }),
    prisma.chatterSchedule.findMany({
      where: creatorId ? { creatorId } : {},
      select: { email: true, name: true, creatorId: true, shift: true },
    }),
    prisma.scheduleShift.findMany({
      where: shiftWhere,
      select: { chatterEmail: true, chatterName: true, creatorId: true, shiftType: true },
    }),
  ]);

  const scheduleMap = new Map<string, ScheduleInfo>();
  for (const s of schedules) {
    scheduleMap.set(s.email, { name: s.name, shift: s.shift });
  }

  return { sessions, scheduleMap, scheduleShifts };
}

/** Attribute transactions + sessions to chatters */
export async function attributeToChatter(
  transactions: TransactionRow[],
  creators: { id: string; name: string | null }[],
  sessions: SessionRow[],
  scheduleMap: Map<string, ScheduleInfo>,
  startDate: Date,
  endDate: Date,
  scheduleShifts?: ShiftEntry[],
): Promise<AttributeResult> {
  // Build attribution resolvers per creator (batch — avoids N+1)
  // Include creators from schedule shifts so chatters show all assigned models
  const uniqueCreatorIds = [...new Set([
    ...transactions.filter(t => isAttributable(t.category)).map(t => t.creatorId),
    ...sessions.map(s => s.creatorId),
    ...(scheduleShifts || []).map(s => s.creatorId),
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
        messageSales: 0, tipSales: 0, postSales: 0,
        txCount: 0, messageTxCount: 0,
        uniqueFans: new Set(),
        clockedSeconds: 0,
        overrideHours: 0, hubstaffHours: 0, unassignedHours: 0,
      });
    }
    return chatterMap.get(email)!;
  }

  // Attribute each transaction to the active chatter at tx.date
  let attributed = 0;
  let skipped = 0;
  let unassigned = 0;

  for (const tx of transactions) {
    if (!isAttributable(tx.category)) {
      skipped++;
      continue;
    }

    const resolver = resolvers.get(tx.creatorId);
    if (!resolver) { skipped++; continue; }

    const attr = resolver.resolve(tx.date);
    if (!attr.email) {
      unassigned++;
      continue;
    }

    attributed++;
    const stats = getOrCreate(attr.email);
    stats.creators.add(creatorNameMap.get(tx.creatorId) || "Unknown");
    stats.txCount += 1;
    stats.uniqueFans.add(tx.fanId);

    switch (tx.category) {
      case "message":
        stats.messageSales += tx.amount;
        stats.messageTxCount += 1;
        break;
      case "tip":
        stats.tipSales += tx.amount;
        break;
      case "post":
        stats.postSales += tx.amount;
        break;
    }
  }

  console.log(`[chatter-perf] Attribution: ${attributed} attributed, ${unassigned} unassigned, ${skipped} skipped (non-attributable)`);

  // Attribute session hours
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
  }

  // Add creator associations from schedule shifts (even if no tx/sessions for that model)
  if (scheduleShifts) {
    for (const s of scheduleShifts) {
      const stats = getOrCreate(s.chatterEmail);
      stats.creators.add(creatorNameMap.get(s.creatorId) || "Unknown");
      // Use schedule name if we don't have one yet
      if (s.chatterName && stats.name === s.chatterEmail.split("@")[0]) {
        stats.name = s.chatterName;
      }
    }
  }

  return { chatterMap, sessions, scheduleMap };
}

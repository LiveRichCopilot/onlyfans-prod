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
  postTxCount: number;
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
      select: { chatterEmail: true, chatterName: true, creatorId: true, shiftType: true, dayOfWeek: true },
    }),
  ]);

  const scheduleMap = new Map<string, ScheduleInfo>();
  for (const s of schedules) {
    scheduleMap.set(s.email, { name: s.name, shift: s.shift });
  }

  // Scheduled hours: each unique (email, dayOfWeek, shiftType) = 8h of work.
  // Covering multiple models in the same shift = still 8h (multitasking).
  // dayOfWeek uses 0-6 (Sun-Sat), same as JS getDay().
  const scheduledHoursMap = new Map<string, number>();
  const seenShifts = new Set<string>();
  for (const s of scheduleShifts) {
    const key = `${s.chatterEmail}|${s.dayOfWeek}|${s.shiftType}`;
    if (seenShifts.has(key)) continue;
    seenShifts.add(key);
    const prev = scheduledHoursMap.get(s.chatterEmail) || 0;
    scheduledHoursMap.set(s.chatterEmail, prev + 8);
  }

  return { sessions, scheduleMap, scheduleShifts, scheduledHoursMap };
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
        messageSales: 0, tipSales: 0, postSales: 0, postTxCount: 0,
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
        stats.postTxCount += 1;
        break;
    }
  }

  console.log(`[chatter-perf] Attribution: ${attributed} attributed, ${unassigned} unassigned, ${skipped} skipped (non-attributable)`);

  // Attribute session hours — dedupe overlapping sessions per chatter
  // (3 models × 8h = 8h worked, not 24h)
  const sessionsByChatter = new Map<string, { start: number; end: number; creatorId: string }[]>();
  for (const s of sessions) {
    const start = Math.max(s.clockIn.getTime(), startDate.getTime());
    const end = Math.min(s.clockOut ? s.clockOut.getTime() : Date.now(), endDate.getTime());
    if (end <= start) continue;
    const arr = sessionsByChatter.get(s.email) || [];
    arr.push({ start, end, creatorId: s.creatorId });
    sessionsByChatter.set(s.email, arr);

    // Still track creator associations per session
    const stats = getOrCreate(s.email);
    stats.creators.add(creatorNameMap.get(s.creatorId) || "Unknown");
  }

  // Merge overlapping intervals per chatter to get real hours worked
  for (const [email, intervals] of sessionsByChatter) {
    intervals.sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const iv of intervals) {
      const last = merged[merged.length - 1];
      if (last && iv.start <= last.end) {
        last.end = Math.max(last.end, iv.end);
      } else {
        merged.push({ start: iv.start, end: iv.end });
      }
    }

    const totalSeconds = merged.reduce((sum, iv) => sum + (iv.end - iv.start) / 1000, 0);
    const totalHours = totalSeconds / 3600;
    const stats = getOrCreate(email);
    stats.clockedSeconds += totalSeconds;

    // Attribution breakdown from merged intervals
    for (const iv of merged) {
      const midpoint = new Date(iv.start + (iv.end - iv.start) / 2);
      const matchingSession = intervals.find(s => s.start <= midpoint.getTime() && s.end >= midpoint.getTime());
      const resolver = matchingSession ? resolvers.get(matchingSession.creatorId) : null;
      const source = resolver ? resolver.resolve(midpoint).source : "hubstaff";
      const hours = (iv.end - iv.start) / 3600000;
      if (source === "override") stats.overrideHours += hours;
      else if (source === "hubstaff") stats.hubstaffHours += hours;
      else stats.unassignedHours += hours;
    }
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

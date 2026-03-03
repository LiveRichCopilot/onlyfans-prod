import { prisma } from "@/lib/prisma";

export type AttributionResult = {
  email: string | null;
  source: "override" | "hubstaff" | "unassigned";
  overrideId?: string;
};

/**
 * Determine the "active chatter" for a model at a specific timestamp.
 *
 * Priority:
 *   1. Manual override (AssignmentOverride where startAt <= T < endAt)
 *   2. Hubstaff/session baseline (ChatterSession where clockIn <= T < clockOut)
 *   3. "Unassigned" (no one scheduled)
 *
 * For Hubstaff baseline with multiple overlapping sessions, picks the one
 * with the most recent clockIn (latest shift started = active chatter).
 */
export async function getActiveChatter(
  creatorId: string,
  timestamp: Date,
): Promise<AttributionResult> {
  // 1. Check manual overrides first
  const override = await prisma.assignmentOverride.findFirst({
    where: {
      creatorId,
      startAt: { lte: timestamp },
      endAt: { gt: timestamp },
    },
    orderBy: { createdAt: "desc" }, // newest override wins if somehow overlapping
  });

  if (override) {
    return {
      email: override.chatterEmail,
      source: "override",
      overrideId: override.id,
    };
  }

  // 2. Check ChatterSession (Hubstaff baseline)
  const session = await prisma.chatterSession.findFirst({
    where: {
      creatorId,
      clockIn: { lte: timestamp },
      OR: [
        { clockOut: { gte: timestamp } },
        { clockOut: null, isLive: true },
      ],
    },
    orderBy: { clockIn: "desc" }, // most recent session started = active chatter
  });

  if (session) {
    return {
      email: session.email,
      source: "hubstaff",
    };
  }

  // 3. No one assigned
  return { email: null, source: "unassigned" };
}

/**
 * Batch version — resolves attribution for multiple timestamps at once.
 * Pre-loads overrides and sessions for the date range to avoid N+1 queries.
 */
export async function getActiveChatterBatch(
  creatorId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  resolve: (timestamp: Date) => AttributionResult;
  overrides: { id: string; chatterEmail: string; startAt: Date; endAt: Date }[];
  sessions: { email: string; clockIn: Date; clockOut: Date | null; isLive: boolean }[];
}> {
  // Pre-load all overrides for this creator in the date range
  const overrides = await prisma.assignmentOverride.findMany({
    where: {
      creatorId,
      startAt: { lte: endDate },
      endAt: { gt: startDate },
    },
    orderBy: { createdAt: "desc" },
  });

  // Pre-load all sessions for this creator in the date range
  const sessions = await prisma.chatterSession.findMany({
    where: {
      creatorId,
      clockIn: { lte: endDate },
      OR: [
        { clockOut: { gte: startDate } },
        { clockOut: null, isLive: true },
      ],
    },
    orderBy: { clockIn: "desc" },
  });

  function resolve(timestamp: Date): AttributionResult {
    const t = timestamp.getTime();

    // 1. Check overrides
    const override = overrides.find(
      (o) => o.startAt.getTime() <= t && o.endAt.getTime() > t
    );
    if (override) {
      return {
        email: override.chatterEmail,
        source: "override",
        overrideId: override.id,
      };
    }

    // 2. Check sessions (already sorted by clockIn desc — first match = most recent)
    const session = sessions.find(
      (s) =>
        s.clockIn.getTime() <= t &&
        (s.clockOut ? s.clockOut.getTime() >= t : s.isLive)
    );
    if (session) {
      return { email: session.email, source: "hubstaff" };
    }

    // 3. Unassigned
    return { email: null, source: "unassigned" };
  }

  return { resolve, overrides, sessions };
}

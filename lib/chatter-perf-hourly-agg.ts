import { prisma } from "@/lib/prisma";

export type HourlyAggregation = {
  dmsSent: number;
  ppvsSent: number;
  fansChatted: number;
  characterCount: number;
  avgResponseTimeSec: number | null;
};

/** Aggregate ChatterHourlyScore activity stats per chatter for a date range */
export async function aggregateHourlyStats(
  startDate: Date,
  endDate: Date,
  creatorId: string | null,
): Promise<Map<string, HourlyAggregation>> {
  const where: Record<string, unknown> = {
    windowStart: { gte: startDate },
    windowEnd: { lte: endDate },
  };
  if (creatorId) where.creatorId = creatorId;

  const scores = await prisma.chatterHourlyScore.findMany({
    where,
    select: {
      chatterEmail: true,
      dmsSent: true,
      ppvsSent: true,
      fansChatted: true,
      characterCount: true,
      avgResponseTimeSec: true,
    },
  });

  const map = new Map<string, HourlyAggregation>();
  const responseTimes = new Map<string, number[]>();

  for (const s of scores) {
    const existing = map.get(s.chatterEmail) || {
      dmsSent: 0, ppvsSent: 0, fansChatted: 0,
      characterCount: 0, avgResponseTimeSec: null,
    };
    existing.dmsSent += s.dmsSent;
    existing.ppvsSent += s.ppvsSent;
    existing.fansChatted += s.fansChatted;
    existing.characterCount += s.characterCount;
    map.set(s.chatterEmail, existing);

    if (s.avgResponseTimeSec !== null) {
      const times = responseTimes.get(s.chatterEmail) || [];
      times.push(s.avgResponseTimeSec);
      responseTimes.set(s.chatterEmail, times);
    }
  }

  for (const [email, times] of responseTimes) {
    const agg = map.get(email);
    if (agg && times.length > 0) {
      agg.avgResponseTimeSec = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  return map;
}

/**
 * Revenue calculations from local Supabase (Prisma) — the source of truth.
 * All time math uses LA time (America/Los_Angeles).
 * OFAPI is only for non-transaction data (subscribers, top %, profile).
 */
import { prisma } from "@/lib/prisma";

// ── LA Time Helpers ──

/** Get the UTC offset for LA right now (handles PST/PDT automatically) */
function getLAOffsetMs(): number {
    const now = new Date();
    const laStr = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour12: false });
    const utcStr = now.toLocaleString("en-US", { timeZone: "UTC", hour12: false });
    return new Date(utcStr).getTime() - new Date(laStr).getTime();
}

/** Get midnight LA today as a UTC Date */
function getMidnightLA(): Date {
    const now = new Date();
    const laDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD
    const [y, m, d] = laDateStr.split("-").map(Number);
    const offsetMs = getLAOffsetMs();
    return new Date(Date.UTC(y, m - 1, d) + offsetMs);
}

/** Standard time boundaries in UTC (based on LA time) */
export function getTimeBoundaries() {
    const now = new Date();
    const todayStart = getMidnightLA();
    return {
        now,
        twentyMinAgo: new Date(now.getTime() - 20 * 60 * 1000),
        oneHourAgo: new Date(now.getTime() - 60 * 60 * 1000),
        todayStart,
        sevenDaysAgo: new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000),
        thirtyDaysAgo: new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
}

// ── Revenue Queries ──

/** Total revenue for a creator in a time window */
export async function getRevenue(creatorId: string, start: Date, end: Date): Promise<number> {
    const result = await prisma.transaction.aggregate({
        where: { creatorId, date: { gte: start, lte: end } },
        _sum: { amount: true },
    });
    return result._sum.amount || 0;
}

/** Transaction count for a creator in a time window */
export async function getTxCount(creatorId: string, start: Date, end: Date): Promise<number> {
    return prisma.transaction.count({
        where: { creatorId, date: { gte: start, lte: end } },
    });
}

/** Top spending fans for a creator in a time window */
export async function getTopFans(creatorId: string, start: Date, end: Date, limit: number = 5) {
    const fans = await prisma.transaction.groupBy({
        by: ["fanId"],
        where: { creatorId, date: { gte: start, lte: end } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: limit,
    });

    // Fetch fan details for the top fans
    const fanIds = fans.map((f: { fanId: string }) => f.fanId);
    const fanDetails = await prisma.fan.findMany({
        where: { id: { in: fanIds } },
        select: { id: true, name: true, username: true },
    });
    const fanMap: Record<string, { id: string; name: string | null; username: string | null }> =
        Object.fromEntries(fanDetails.map((f: { id: string; name: string | null; username: string | null }) => [f.id, f]));

    return fans.map((f: { fanId: string; _sum: { amount: number | null } }) => ({
        username: fanMap[f.fanId]?.username || "unknown",
        name: fanMap[f.fanId]?.name || "Unknown",
        spend: f._sum.amount || 0,
    }));
}

/** Earnings breakdown by transaction type for a creator */
export async function getEarningsByTypeLocal(creatorId: string, start: Date, end: Date) {
    const groups = await prisma.transaction.groupBy({
        by: ["type"],
        where: { creatorId, date: { gte: start, lte: end }, type: { not: null } },
        _sum: { amount: true },
    });

    const result: Record<string, number> = {};
    for (const g of groups) {
        if (g.type) result[g.type] = g._sum.amount || 0;
    }
    return result;
}

/** Average spend per transaction and per unique spender */
export async function getAverages(creatorId: string, start: Date, end: Date) {
    const [totalAgg, countAgg] = await Promise.all([
        prisma.transaction.aggregate({
            where: { creatorId, date: { gte: start, lte: end } },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.transaction.groupBy({
            by: ["fanId"],
            where: { creatorId, date: { gte: start, lte: end } },
        }),
    ]);

    const totalAmount = totalAgg._sum.amount || 0;
    const txCount = totalAgg._count || 0;
    const uniqueSpenders = countAgg.length;

    return {
        avgPerTransaction: txCount > 0 ? totalAmount / txCount : 0,
        avgPerSpender: uniqueSpenders > 0 ? totalAmount / uniqueSpenders : 0,
    };
}

/** Daily revenue chart data for a creator (last N days) */
export async function getDailyChart(creatorId: string, days: number = 7) {
    const tb = getTimeBoundaries();
    const startDate = new Date(tb.todayStart.getTime() - days * 24 * 60 * 60 * 1000);

    // Raw query for daily grouping (Postgres date_trunc in LA timezone)
    const rows: any[] = await prisma.$queryRaw`
        SELECT
            DATE("date" AT TIME ZONE 'America/Los_Angeles') as day,
            SUM(amount) as revenue,
            COUNT(*) as tx_count
        FROM "Transaction"
        WHERE "creatorId" = ${creatorId}
          AND "date" >= ${startDate}
          AND "date" <= ${tb.now}
        GROUP BY DATE("date" AT TIME ZONE 'America/Los_Angeles')
        ORDER BY day ASC
    `;

    return rows.map((r) => ({
        date: r.day instanceof Date ? r.day.toISOString().substring(0, 10) : String(r.day),
        revenue: Number(r.revenue) || 0,
        txCount: Number(r.tx_count) || 0,
    }));
}

// ── All-in-one for dashboard card (1 creator) ──

export async function getCreatorDashboardStats(creatorId: string) {
    const tb = getTimeBoundaries();

    const [todayRev, hourlyRev, txCount, topFans] = await Promise.all([
        getRevenue(creatorId, tb.todayStart, tb.now),
        getRevenue(creatorId, tb.oneHourAgo, tb.now),
        getTxCount(creatorId, tb.todayStart, tb.now),
        getTopFans(creatorId, tb.todayStart, tb.now, 3),
    ]);

    return { todayRev, hourlyRev, txCount, topFans };
}

// ── All-in-one for creator profile page ──

export async function getCreatorProfileStats(creatorId: string) {
    const tb = getTimeBoundaries();

    const [
        todayRevenue, hourlyRevenue, weeklyRevenue, monthlyRevenue,
        txCountToday, averages,
        topFansToday, topFansWeek, topFansMonth,
        earningsByType, dailyChart,
    ] = await Promise.all([
        getRevenue(creatorId, tb.todayStart, tb.now),
        getRevenue(creatorId, tb.oneHourAgo, tb.now),
        getRevenue(creatorId, tb.sevenDaysAgo, tb.now),
        getRevenue(creatorId, tb.thirtyDaysAgo, tb.now),
        getTxCount(creatorId, tb.todayStart, tb.now),
        getAverages(creatorId, tb.todayStart, tb.now),
        getTopFans(creatorId, tb.todayStart, tb.now, 5),
        getTopFans(creatorId, tb.sevenDaysAgo, tb.now, 5),
        getTopFans(creatorId, tb.thirtyDaysAgo, tb.now, 10),
        getEarningsByTypeLocal(creatorId, tb.thirtyDaysAgo, tb.now),
        getDailyChart(creatorId, 7),
    ]);

    return {
        todayRevenue, hourlyRevenue, weeklyRevenue, monthlyRevenue,
        txCountToday,
        avgSpendPerTransaction: averages.avgPerTransaction,
        avgSpendPerSpender: averages.avgPerSpender,
        topFansToday, topFansWeek, topFansMonth,
        earningsByType: {
            tips: earningsByType["tip"] || 0,
            messages: earningsByType["message"] || 0,
            posts: earningsByType["post"] || 0,
            subscriptions: earningsByType["subscription"] || 0,
            streams: earningsByType["stream"] || 0,
            referrals: earningsByType["referral"] || 0,
        },
        dailyChart,
    };
}

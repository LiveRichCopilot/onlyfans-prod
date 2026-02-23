import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/fan-details — Hybrid: DB first, OFAPI fallback
 *
 * ?creatorId=xxx&fanId=xxx (fanId = OFAPI fan ID string)
 *
 * Returns: spend breakdowns, last 10 purchases, buy patterns,
 *          fan intelligence, preferences, facts
 *
 * Data sources:
 * - Spend totals: OFAPI subscribedOnData (authoritative) + DB Fan.lifetimeSpend
 * - Purchase history: DB Transaction table (populated by sync/webhook)
 * - If DB empty: falls back to OFAPI live transactions for this fan
 * - Intelligence/preferences/facts: always from DB
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const fanId = searchParams.get("fanId") ? String(searchParams.get("fanId")) : null;

    if (!creatorId || !fanId) {
        return NextResponse.json({ error: "Missing creatorId or fanId" }, { status: 400 });
    }

    try {
        // Find fan in DB
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanId, creatorId },
            include: {
                preferences: { orderBy: { weight: "desc" }, take: 20 },
                facts: { orderBy: { lastConfirmedAt: "desc" }, take: 20 },
            },
        });

        // Get purchases from DB
        let purchases: any[] = [];
        let txCount = 0;
        let buyPatterns: any = null;

        if (fan) {
            purchases = await prisma.transaction.findMany({
                where: { fanId: fan.id, creatorId },
                orderBy: { date: "desc" },
                take: 10,
                select: { id: true, ofapiTxId: true, amount: true, type: true, date: true },
            });

            txCount = await prisma.transaction.count({
                where: { fanId: fan.id, creatorId },
            });

            // Compute buy patterns if we have enough data
            if (txCount >= 3) {
                buyPatterns = await computeBuyPatterns(fan.id, creatorId);
            }
        }

        // If DB has no transactions, try OFAPI live as fallback
        if (txCount === 0 && fan) {
            const ofapiResult = await fetchOfapiFanTransactions(creatorId, fanId);
            if (ofapiResult) {
                purchases = ofapiResult.purchases;
                txCount = ofapiResult.txCount;
                if (txCount >= 3) {
                    buyPatterns = computeBuyPatternsFromRaw(ofapiResult.rawDates);
                }
            }
        }

        const fmtDate = (d: Date | null) =>
            d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

        // Build spend breakdown from fan data
        const spendBreakdown = fan ? {
            total: Math.round((fan.lifetimeSpend || 0) * 100) / 100,
            // These would come from OFAPI subscribedOnData if stored, or be null
            lastPurchaseType: fan.lastPurchaseType,
            lastPurchaseAmount: fan.lastPurchaseAmount,
        } : null;

        return NextResponse.json({
            fanId,
            found: !!fan,
            totalSpend: Math.round((fan?.lifetimeSpend || 0) * 100) / 100,
            lastPaid: fmtDate(fan?.lastPurchaseAt || null),
            lastPurchaseType: fan?.lastPurchaseType || null,
            lastPurchaseAmount: fan?.lastPurchaseAmount || null,
            fanSince: fmtDate(fan?.firstPurchaseAt || fan?.createdAt || null),
            txCount,
            spendBreakdown,
            buyPatterns,
            purchases: purchases.map(p => ({
                id: p.id || p.ofapiTxId,
                ofapiTxId: p.ofapiTxId,
                amount: p.amount,
                type: p.type || "unknown",
                date: typeof p.date === "string" ? p.date : p.date?.toISOString(),
            })),
            intelligence: fan ? {
                stage: fan.stage,
                fanType: fan.fanType,
                tonePreference: fan.tonePreference,
                priceRange: fan.priceRange,
                buyerType: fan.buyerType,
                intentScore: fan.intentScore,
                timeWasterScore: fan.timeWasterScore,
                conversionRate: fan.conversionRate,
                avgOrderValue: fan.avgOrderValue,
                formatPreference: fan.formatPreference,
                nextBestAction: fan.nextBestAction,
                nextBestActionReason: fan.nextBestActionReason,
                emotionalDrivers: fan.emotionalDrivers,
                emotionalNeeds: fan.emotionalNeeds,
                narrativeSummary: fan.narrativeSummary,
                lastMessageAt: fan.lastMessageAt?.toISOString() || null,
                followUpDueAt: fan.followUpDueAt?.toISOString() || null,
            } : null,
            preferences: (fan?.preferences || []).map(p => ({
                tag: p.tag, weight: p.weight, source: p.source,
            })),
            facts: (fan?.facts || []).map(f => ({
                key: f.key, value: f.value, confidence: f.confidence, source: f.source,
            })),
        });
    } catch (e: any) {
        console.error("Fan details error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * Fallback: fetch this fan's transactions from OFAPI live
 * Only used when DB Transaction table is empty for this fan
 */
async function fetchOfapiFanTransactions(creatorId: string, fanOfapiId: string) {
    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) return null;

    try {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator?.ofapiCreatorId) return null;

        const accountName = creator.ofapiCreatorId;
        const txRes = await getTransactions(accountName, apiKey);
        const allTx = txRes?.data?.list || txRes?.list || txRes?.data || [];

        // Filter to this fan's transactions
        const fanTx = allTx.filter((t: any) => {
            const uid = t.user?.id?.toString() || t.fan?.id?.toString();
            return uid === fanOfapiId;
        });

        if (fanTx.length === 0) return null;

        // Sort newest first
        const sorted = [...fanTx].sort((a: any, b: any) =>
            new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        );

        return {
            txCount: sorted.length,
            rawDates: sorted.map((t: any) => new Date(t.createdAt || t.date)),
            purchases: sorted.slice(0, 10).map((t: any) => ({
                id: t.id?.toString(),
                ofapiTxId: t.id?.toString(),
                amount: Math.abs(parseFloat(t.amount) || 0),
                type: t.type || t.transactionType || "unknown",
                date: new Date(t.createdAt || t.date).toISOString(),
            })),
        };
    } catch (e: any) {
        console.error("OFAPI fan tx fallback error:", e.message);
        return null;
    }
}

/**
 * Compute buy patterns from DB transactions
 * Returns: favorite day of week, favorite hour, avg days between purchases
 */
async function computeBuyPatterns(fanId: string, creatorId: string) {
    const transactions = await prisma.transaction.findMany({
        where: { fanId, creatorId },
        orderBy: { date: "asc" },
        select: { date: true, amount: true, type: true },
    });

    if (transactions.length < 3) return null;

    return computeBuyPatternsFromRaw(
        transactions.map(t => t.date),
        transactions.map(t => ({ amount: t.amount, type: t.type }))
    );
}

/**
 * Compute buy patterns from raw date arrays
 */
function computeBuyPatternsFromRaw(dates: Date[], txDetails?: { amount: number; type: string | null }[]) {
    if (dates.length < 3) return null;

    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Count purchases by day of week
    const dayCount: Record<number, number> = {};
    const hourCount: Record<number, number> = {};

    for (const d of dates) {
        const day = d.getDay();
        const hour = d.getHours();
        dayCount[day] = (dayCount[day] || 0) + 1;
        hourCount[hour] = (hourCount[hour] || 0) + 1;
    }

    // Find favorite day
    const favDay = Object.entries(dayCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    // Find favorite hour
    const favHour = Object.entries(hourCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Average days between purchases
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    let totalGap = 0;
    for (let i = 1; i < sortedDates.length; i++) {
        totalGap += (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / 86400000;
    }
    const avgDaysBetween = Math.round(totalGap / (sortedDates.length - 1));

    // Spend by type breakdown
    const typeBreakdown: Record<string, { count: number; total: number }> = {};
    if (txDetails) {
        for (const tx of txDetails) {
            const t = tx.type || "unknown";
            if (!typeBreakdown[t]) typeBreakdown[t] = { count: 0, total: 0 };
            typeBreakdown[t].count++;
            typeBreakdown[t].total += tx.amount;
        }
    }

    // Format hour as readable
    const hourNum = Number(favHour[0]);
    const hourLabel = hourNum === 0 ? "12 AM" : hourNum < 12 ? `${hourNum} AM` : hourNum === 12 ? "12 PM" : `${hourNum - 12} PM`;

    return {
        favoriteDayOfWeek: DAYS[Number(favDay[0])],
        favoriteDayCount: Number(favDay[1]),
        favoriteHour: hourLabel,
        favoriteHourCount: Number(favHour[1]),
        avgDaysBetweenPurchases: avgDaysBetween,
        totalPurchases: dates.length,
        typeBreakdown: Object.entries(typeBreakdown).map(([type, data]) => ({
            type,
            count: data.count,
            total: Math.round(data.total * 100) / 100,
        })),
    };
}

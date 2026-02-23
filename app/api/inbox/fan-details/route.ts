import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/fan-details — Fan details from Supabase (persistent DB)
 *
 * ?creatorId=xxx&fanId=xxx (fanId = OFAPI fan ID string)
 *
 * Returns: total spend, last paid, fan since, purchase count,
 *          last 10 purchases with type/amount/date,
 *          fan intelligence fields (stage, fanType, preferences, etc.)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const fanId = searchParams.get("fanId"); // This is the OFAPI fan ID (string)

    if (!creatorId || !fanId) {
        return NextResponse.json({ error: "Missing creatorId or fanId" }, { status: 400 });
    }

    try {
        // Find fan by OFAPI ID
        const fan = await prisma.fan.findFirst({
            where: {
                ofapiFanId: fanId,
                creatorId: creatorId,
            },
            include: {
                preferences: {
                    orderBy: { weight: "desc" },
                    take: 20,
                },
                facts: {
                    orderBy: { lastConfirmedAt: "desc" },
                    take: 20,
                },
            },
        });

        if (!fan) {
            // Fan not in DB yet — return empty state
            return NextResponse.json({
                fanId,
                found: false,
                totalSpend: 0,
                lastPaid: null,
                fanSince: null,
                txCount: 0,
                purchases: [],
                intelligence: null,
                preferences: [],
                facts: [],
            });
        }

        // Get last 10 purchases from Transaction table
        const purchases = await prisma.transaction.findMany({
            where: {
                fanId: fan.id,
                creatorId: creatorId,
            },
            orderBy: { date: "desc" },
            take: 10,
            select: {
                id: true,
                ofapiTxId: true,
                amount: true,
                type: true,
                date: true,
            },
        });

        // Get total transaction count
        const txCount = await prisma.transaction.count({
            where: {
                fanId: fan.id,
                creatorId: creatorId,
            },
        });

        // Format dates
        const fmtDate = (d: Date | null) =>
            d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

        return NextResponse.json({
            fanId,
            found: true,
            totalSpend: Math.round((fan.lifetimeSpend || 0) * 100) / 100,
            lastPaid: fmtDate(fan.lastPurchaseAt),
            lastPurchaseType: fan.lastPurchaseType,
            lastPurchaseAmount: fan.lastPurchaseAmount,
            fanSince: fmtDate(fan.firstPurchaseAt || fan.createdAt),
            txCount,
            // Last 10 purchases
            purchases: purchases.map(p => ({
                id: p.id,
                ofapiTxId: p.ofapiTxId,
                amount: p.amount,
                type: p.type || "unknown",
                date: p.date.toISOString(),
            })),
            // Fan intelligence
            intelligence: {
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
            },
            // Preferences (tags with weights)
            preferences: fan.preferences.map(p => ({
                tag: p.tag,
                weight: p.weight,
                source: p.source,
            })),
            // Facts (key-value memory)
            facts: fan.facts.map(f => ({
                key: f.key,
                value: f.value,
                confidence: f.confidence,
                source: f.source,
            })),
        });
    } catch (e: any) {
        console.error("Fan details error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

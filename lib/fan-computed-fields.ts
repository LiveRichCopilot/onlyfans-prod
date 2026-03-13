import { PrismaClient } from "@prisma/client";

/**
 * Update all computed fields on Fan records for a given creator.
 * Runs bulk SQL for: lastPurchaseAt, lifetimeSpend, avgOrderValue,
 * biggestPurchase, firstPurchaseAt, buyerType, priceRange, messageCount, lastActiveAt.
 *
 * Returns array of error strings (empty = all succeeded).
 */
export async function updateFanComputedFields(prisma: PrismaClient, creatorId: string): Promise<string[]> {
    const errors: string[] = [];

    // 1. lastPurchaseAt + lifetimeSpend
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "lastPurchaseAt" = sub."lastDate",
                "lastPurchaseType" = sub."lastType",
                "lastPurchaseAmount" = sub."lastAmount"
            FROM (
                SELECT DISTINCT ON ("fanId")
                    "fanId", "date" as "lastDate", "type" as "lastType", "amount" as "lastAmount"
                FROM "Transaction"
                WHERE "creatorId" = ${creatorId}
                ORDER BY "fanId", "date" DESC
            ) sub
            WHERE f."id" = sub."fanId"
        `;
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "lifetimeSpend" = sub."total"
            FROM (
                SELECT "fanId", SUM("amount") as "total"
                FROM "Transaction"
                WHERE "creatorId" = ${creatorId}
                GROUP BY "fanId"
            ) sub
            WHERE f."id" = sub."fanId"
        `;
    } catch (e: any) {
        errors.push(`lastPurchaseAt/lifetimeSpend: ${e.message}`);
    }

    // 2. Average Order Value (positive only)
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "avgOrderValue" = sub."avg"
            FROM (
                SELECT "fanId", AVG("amount") as "avg"
                FROM "Transaction"
                WHERE "creatorId" = ${creatorId} AND "amount" > 0
                GROUP BY "fanId"
            ) sub
            WHERE f."id" = sub."fanId"
        `;
    } catch (e: any) {
        errors.push(`avgOrderValue: ${e.message}`);
    }

    // 3. Biggest Purchase (positive only)
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "biggestPurchase" = sub."max"
            FROM (
                SELECT "fanId", MAX("amount") as "max"
                FROM "Transaction"
                WHERE "creatorId" = ${creatorId} AND "amount" > 0
                GROUP BY "fanId"
            ) sub
            WHERE f."id" = sub."fanId"
        `;
    } catch (e: any) {
        errors.push(`biggestPurchase: ${e.message}`);
    }

    // 4. First Purchase Date (only if not already set)
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "firstPurchaseAt" = sub."first_date"
            FROM (
                SELECT "fanId", MIN("date") as "first_date"
                FROM "Transaction"
                WHERE "creatorId" = ${creatorId}
                GROUP BY "fanId"
            ) sub
            WHERE f."id" = sub."fanId"
            AND f."firstPurchaseAt" IS NULL
        `;
    } catch (e: any) {
        errors.push(`firstPurchaseAt: ${e.message}`);
    }

    // 5. Buyer Type (dominant tx type in last 30 days)
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "buyerType" = sub."dominant_type"
            FROM (
                SELECT DISTINCT ON ("fanId")
                    "fanId",
                    CASE
                        WHEN "type" = 'tip' THEN 'tipper'
                        WHEN "type" = 'message' THEN 'ppv_buyer'
                        WHEN "type" = 'subscription' THEN 'subscriber_only'
                        ELSE 'subscriber_only'
                    END as "dominant_type"
                FROM (
                    SELECT "fanId", "type", COUNT(*) as cnt
                    FROM "Transaction"
                    WHERE "creatorId" = ${creatorId}
                    AND "date" >= NOW() - INTERVAL '30 days'
                    GROUP BY "fanId", "type"
                    ORDER BY "fanId", cnt DESC
                ) ranked
            ) sub
            WHERE f."id" = sub."fanId"
        `;
    } catch (e: any) {
        errors.push(`buyerType: ${e.message}`);
    }

    // 6. Price Range (based on lifetimeSpend)
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "priceRange" = CASE
                    WHEN f."lifetimeSpend" >= 200 THEN 'whale'
                    WHEN f."lifetimeSpend" >= 50 THEN 'high'
                    WHEN f."lifetimeSpend" >= 10 THEN 'mid'
                    WHEN f."lifetimeSpend" > 0 THEN 'low'
                    ELSE 'none'
                END
            WHERE f."creatorId" = ${creatorId}
        `;
    } catch (e: any) {
        errors.push(`priceRange: ${e.message}`);
    }

    // 7. Message count + last active from RawChatMessage
    try {
        await prisma.$executeRaw`
            UPDATE "Fan" f SET
                "messageCount" = sub."msgCount",
                "lastActiveAt" = sub."lastMsg"
            FROM (
                SELECT r."chatId", COUNT(*) as "msgCount", MAX(r."sentAt") as "lastMsg"
                FROM "RawChatMessage" r
                WHERE r."creatorId" = ${creatorId}
                  AND r."isFromCreator" = false
                GROUP BY r."chatId"
            ) sub
            WHERE f."ofapiFanId" = sub."chatId"
              AND f."creatorId" = ${creatorId}
        `;
    } catch (e: any) {
        errors.push(`messageCount: ${e.message}`);
    }

    return errors;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllTransactions, getActiveFans } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-transactions — Round-robin sync, ONE creator per invocation
 *
 * Runs every 5 min via Vercel Cron.
 * Picks the creator with the oldest lastSyncCursor (or never synced).
 * Syncs fans + transactions (24h lookback) for that ONE creator.
 * With 9 creators at 5-min intervals, each gets synced ~every 45 min.
 *
 * ?creatorId=xxx — force sync a specific creator (for manual/debug)
 * ?backfill=true — 30-day lookback instead of 24h
 */
export async function GET(req: NextRequest) {
    // Auth guard (skip in dev)
    if (process.env.NODE_ENV === "production") {
        const authHeader = req.headers.get("Authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
    }

    const startTime = Date.now();
    const backfill = req.nextUrl.searchParams.get("backfill") === "true";
    const forceCreatorId = req.nextUrl.searchParams.get("creatorId");
    const hoursBack = backfill ? 30 * 24 : 24;
    const maxTx = backfill ? 5000 : 2000;

    try {
        let creator: any;

        if (forceCreatorId) {
            // Forced creator
            creator = await prisma.creator.findUnique({ where: { id: forceCreatorId } });
        } else {
            // Round-robin: pick creator with oldest sync (or never synced)
            creator = await prisma.creator.findFirst({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
                orderBy: [
                    { lastSyncCursor: "asc" }, // nulls first (never synced), then oldest
                ],
            });
        }

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ status: "no_creator_to_sync" });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;
        const timing: Record<string, number> = {};
        const result = {
            creatorId: creator.id,
            name: creator.name || creator.ofUsername || accountName,
            fansUpserted: 0,
            txUpserted: 0,
            lastPurchaseUpdated: 0,
            computedFieldsUpdated: 0,
            errors: [] as string[],
        };

        // --- 1. Sync Fans (batch createMany) ---
        let t0 = Date.now();
        try {
            const fansRes = await getActiveFans(accountName, apiKey);
            const fans: any[] = fansRes?.data?.list || fansRes?.data || fansRes?.list || (Array.isArray(fansRes) ? fansRes : []);
            timing.fansFetchMs = Date.now() - t0;

            const fanRecords = fans
                .filter((f: any) => f.id)
                .map((f: any) => ({
                    ofapiFanId: f.id.toString(),
                    creatorId: creator.id,
                    name: f.name || f.displayName || null,
                    username: f.username || null,
                    lifetimeSpend: f.subscribedOnData?.totalSumm || 0,
                }));

            if (fanRecords.length > 0) {
                t0 = Date.now();
                const created = await prisma.fan.createMany({
                    data: fanRecords,
                    skipDuplicates: true,
                });
                result.fansUpserted = created.count;
                timing.fansWriteMs = Date.now() - t0;
            }
        } catch (e: any) {
            result.errors.push(`Fan sync: ${e.message}`);
        }

        // --- 2. Sync Transactions (batch, append-only) ---
        t0 = Date.now();
        try {
            const startWindow = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
            const transactions = await fetchAllTransactions(accountName, apiKey, startWindow, maxTx);
            timing.txFetchMs = Date.now() - t0;

            if (transactions.length > 0) {
                // Ensure all fans exist first (batch create missing)
                const allFanIds = [...new Set(
                    transactions.map((tx: any) => tx.user?.id?.toString()).filter(Boolean)
                )];

                t0 = Date.now();
                const existingFans = await prisma.fan.findMany({
                    where: { ofapiFanId: { in: allFanIds } },
                    select: { id: true, ofapiFanId: true },
                });
                const fanMap = new Map(existingFans.map(f => [f.ofapiFanId, f.id]));

                // Create missing fans
                const missingFanIds = allFanIds.filter(id => !fanMap.has(id));
                if (missingFanIds.length > 0) {
                    const missingFanData = missingFanIds.map(fanId => {
                        const tx = transactions.find((t: any) => t.user?.id?.toString() === fanId);
                        return {
                            ofapiFanId: fanId,
                            creatorId: creator.id,
                            name: tx?.user?.name || tx?.user?.displayName || null,
                            username: tx?.user?.username || null,
                            lifetimeSpend: 0,
                        };
                    });
                    await prisma.fan.createMany({ data: missingFanData, skipDuplicates: true });

                    // Refresh map
                    const newFans = await prisma.fan.findMany({
                        where: { ofapiFanId: { in: missingFanIds } },
                        select: { id: true, ofapiFanId: true },
                    });
                    for (const f of newFans) fanMap.set(f.ofapiFanId, f.id);
                }
                timing.fanLookupMs = Date.now() - t0;

                // Batch create transactions (append-only, skip dupes)
                t0 = Date.now();
                const txRecords = transactions
                    .filter((tx: any) => {
                        const txId = tx.id?.toString();
                        const fanId = tx.user?.id?.toString();
                        return txId && fanId && fanMap.has(fanId);
                    })
                    .map((tx: any) => ({
                        ofapiTxId: tx.id.toString(),
                        fanId: fanMap.get(tx.user.id.toString())!,
                        creatorId: creator.id,
                        amount: Math.abs(Number(tx.amount) || 0),
                        type: tx.type || tx.description || "unknown",
                        date: new Date(tx.createdAt || tx.date || new Date()),
                    }))
                    .filter((tx: any) => tx.amount > 0);

                if (txRecords.length > 0) {
                    // Chunk into batches of 500 to avoid query size limits
                    let totalCreated = 0;
                    for (let i = 0; i < txRecords.length; i += 500) {
                        const chunk = txRecords.slice(i, i + 500);
                        const created = await prisma.transaction.createMany({
                            data: chunk,
                            skipDuplicates: true,
                        });
                        totalCreated += created.count;
                    }
                    result.txUpserted = totalCreated;
                }
                timing.txWriteMs = Date.now() - t0;
            }
        } catch (e: any) {
            result.errors.push(`Transaction sync: ${e.message}`);
        }

        // --- 3. Update lastPurchaseAt + lifetimeSpend (bulk SQL) ---
        t0 = Date.now();
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
                    WHERE "creatorId" = ${creator.id}
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
                    WHERE "creatorId" = ${creator.id}
                    GROUP BY "fanId"
                ) sub
                WHERE f."id" = sub."fanId"
            `;
            timing.updateMs = Date.now() - t0;
        } catch (e: any) {
            result.errors.push(`lastPurchaseAt update: ${e.message}`);
        }

        // --- 4. Update computed fields (bulk SQL) ---
        t0 = Date.now();

        // 4a. Average Order Value
        try {
            await prisma.$executeRaw`
                UPDATE "Fan" f SET
                    "avgOrderValue" = sub."avg"
                FROM (
                    SELECT "fanId", AVG("amount") as "avg"
                    FROM "Transaction"
                    WHERE "creatorId" = ${creator.id}
                    GROUP BY "fanId"
                ) sub
                WHERE f."id" = sub."fanId"
            `;
        } catch (e: any) {
            result.errors.push(`avgOrderValue update: ${e.message}`);
        }

        // 4b. Biggest Purchase
        try {
            await prisma.$executeRaw`
                UPDATE "Fan" f SET
                    "biggestPurchase" = sub."max"
                FROM (
                    SELECT "fanId", MAX("amount") as "max"
                    FROM "Transaction"
                    WHERE "creatorId" = ${creator.id}
                    GROUP BY "fanId"
                ) sub
                WHERE f."id" = sub."fanId"
            `;
        } catch (e: any) {
            result.errors.push(`biggestPurchase update: ${e.message}`);
        }

        // 4c. First Purchase Date (only if not already set)
        try {
            await prisma.$executeRaw`
                UPDATE "Fan" f SET
                    "firstPurchaseAt" = sub."first_date"
                FROM (
                    SELECT "fanId", MIN("date") as "first_date"
                    FROM "Transaction"
                    WHERE "creatorId" = ${creator.id}
                    GROUP BY "fanId"
                ) sub
                WHERE f."id" = sub."fanId"
                AND f."firstPurchaseAt" IS NULL
            `;
        } catch (e: any) {
            result.errors.push(`firstPurchaseAt update: ${e.message}`);
        }

        // 4d. Buyer Type (dominant transaction type in last 30 days)
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
                        WHERE "creatorId" = ${creator.id}
                        AND "date" >= NOW() - INTERVAL '30 days'
                        GROUP BY "fanId", "type"
                        ORDER BY "fanId", cnt DESC
                    ) ranked
                ) sub
                WHERE f."id" = sub."fanId"
            `;
        } catch (e: any) {
            result.errors.push(`buyerType update: ${e.message}`);
        }

        // 4e. Price Range (based on lifetimeSpend)
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
                WHERE f."creatorId" = ${creator.id}
            `;
        } catch (e: any) {
            result.errors.push(`priceRange update: ${e.message}`);
        }

        timing.computedFieldsMs = Date.now() - t0;
        result.computedFieldsUpdated = 1;

        // --- 5. Mark sync time ---
        await prisma.creator.update({
            where: { id: creator.id },
            data: { lastSyncCursor: new Date().toISOString() },
        });

        const durationMs = Date.now() - startTime;

        console.log(`[Cron Sync] ${result.name}: ${result.fansUpserted} fans, ${result.txUpserted} tx, ${durationMs}ms`, timing);

        return NextResponse.json({
            status: "ok",
            mode: backfill ? "backfill_30d" : "standard_24h",
            durationMs,
            timing,
            ...result,
        });
    } catch (err: any) {
        console.error("Cron sync error:", err.message);
        return NextResponse.json({ error: err.message, durationMs: Date.now() - startTime }, { status: 500 });
    }
}

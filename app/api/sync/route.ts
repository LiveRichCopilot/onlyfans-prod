import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveFans, fetchAllTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/sync — Sync fans + transactions from OFAPI into Supabase
 *
 * ?creatorId=xxx — sync ONE creator (fast, stays under 60s)
 * No param       — returns list of creators to sync (caller iterates)
 *
 * This is the persistent memory — every agency, every creator, every fan.
 */
export async function POST(request: Request) {
    const syncSecret = process.env.SYNC_SECRET;
    if (syncSecret) {
        const provided = request.headers.get("x-sync-key");
        if (provided !== syncSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");

    try {
        // If no creatorId, return list of creators for the caller to iterate
        if (!creatorId) {
            const creators = await prisma.creator.findMany({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    ofUsername: true,
                    ofapiCreatorId: true,
                    lastSyncCursor: true,
                },
                orderBy: { lastSyncCursor: "asc" }, // oldest sync first
            });

            return NextResponse.json({
                action: "list",
                message: "Pass ?creatorId=xxx to sync one creator at a time",
                creators: creators.map(c => ({
                    id: c.id,
                    name: c.name || c.ofUsername || c.ofapiCreatorId,
                    lastSync: c.lastSyncCursor || "never",
                })),
            });
        }

        // --- Single creator sync ---
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not found or unlinked" }, { status: 404 });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;
        const result = {
            creatorId: creator.id,
            name: creator.name || accountName,
            fansUpserted: 0,
            txUpserted: 0,
            lastPurchaseUpdated: 0,
            errors: [] as string[],
        };

        // --- 1. Sync Fans (batch) ---
        try {
            const fansRes = await getActiveFans(accountName, apiKey);
            const fans: any[] = fansRes?.data?.list || fansRes?.data || fansRes?.list || (Array.isArray(fansRes) ? fansRes : []);

            // Batch upsert — createMany for new, then update existing
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
                // Create new fans (skip dupes)
                const created = await prisma.fan.createMany({
                    data: fanRecords,
                    skipDuplicates: true,
                });
                result.fansUpserted = created.count;

                // Update existing fans' names/usernames
                const existingFanIds = fanRecords.map(f => f.ofapiFanId);
                const existingFans = await prisma.fan.findMany({
                    where: { ofapiFanId: { in: existingFanIds } },
                    select: { id: true, ofapiFanId: true },
                });

                // Batch update with raw SQL for speed
                for (const fan of fans.filter((f: any) => f.id)) {
                    const dbFan = existingFans.find(ef => ef.ofapiFanId === fan.id.toString());
                    if (dbFan) {
                        const spend = fan.subscribedOnData?.totalSumm;
                        await prisma.fan.update({
                            where: { id: dbFan.id },
                            data: {
                                name: fan.name || fan.displayName || undefined,
                                username: fan.username || undefined,
                                ...(spend && spend > 0 ? { lifetimeSpend: spend } : {}),
                            },
                        });
                    }
                }
            }
        } catch (e: any) {
            result.errors.push(`Fan sync: ${e.message}`);
        }

        // --- 2. Sync Transactions (last 30 days, batch) ---
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const transactions = await fetchAllTransactions(accountName, apiKey, thirtyDaysAgo, 3000);

            // Build lookup of existing fans by ofapiFanId
            const allFanIds = [...new Set(transactions.map((tx: any) => tx.user?.id?.toString()).filter(Boolean))];
            const existingFans = await prisma.fan.findMany({
                where: { ofapiFanId: { in: allFanIds } },
                select: { id: true, ofapiFanId: true },
            });
            const fanMap = new Map(existingFans.map(f => [f.ofapiFanId, f.id]));

            // Create missing fans first (batch)
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

            // Batch create transactions (skip dupes)
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
                    amount: Math.abs(Number(tx.price || tx.gross || tx.amount) || 0),
                    type: ((tx.type || tx.description || "unknown").replace(/<[^>]*>/g, "").replace(/&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 50).replace(/[\uD800-\uDFFF]/g, "").trim()) || "unknown",
                    date: new Date(tx.createdAt || tx.date || new Date()),
                }));

            if (txRecords.length > 0) {
                const created = await prisma.transaction.createMany({
                    data: txRecords,
                    skipDuplicates: true,
                });
                result.txUpserted = created.count;
            }
        } catch (e: any) {
            result.errors.push(`Transaction sync: ${e.message}`);
        }

        // --- 3. Update lastPurchaseAt + lifetimeSpend via raw SQL (fast) ---
        try {
            // Update lastPurchaseAt, lastPurchaseType, lastPurchaseAmount from most recent tx
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

            // Update lifetimeSpend from sum of transactions
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

            // Count how many fans were updated
            const updatedCount = await prisma.fan.count({
                where: {
                    creatorId: creator.id,
                    lastPurchaseAt: { not: null },
                },
            });
            result.lastPurchaseUpdated = updatedCount;
        } catch (e: any) {
            result.errors.push(`lastPurchaseAt update: ${e.message}`);
        }

        // --- 4. Mark sync time ---
        await prisma.creator.update({
            where: { id: creator.id },
            data: { lastSyncCursor: new Date().toISOString() },
        });

        return NextResponse.json({
            success: true,
            syncedAt: new Date().toISOString(),
            ...result,
        });
    } catch (e: any) {
        console.error("Sync error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * GET /api/sync — Check sync status / dashboard metrics
 */
export async function GET() {
    try {
        const [fanCount, txCount, recentBuyers, creatorsLinked, creators] = await Promise.all([
            prisma.fan.count(),
            prisma.transaction.count(),
            prisma.fan.count({
                where: { lastPurchaseAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
            }),
            prisma.creator.count({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
            }),
            prisma.creator.findMany({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
                select: { id: true, name: true, ofUsername: true, lastSyncCursor: true },
            }),
        ]);

        return NextResponse.json({
            fanCount,
            transactionCount: txCount,
            recentBuyers30min: recentBuyers,
            creatorsLinked,
            creators: creators.map(c => ({
                id: c.id,
                name: c.name || c.ofUsername,
                lastSync: c.lastSyncCursor || "never",
            })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

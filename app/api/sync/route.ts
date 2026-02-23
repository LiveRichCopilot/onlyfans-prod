import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveFans, fetchAllTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for full sync

/**
 * POST /api/sync — Sync fans + transactions from OFAPI into Supabase
 *
 * For every connected creator:
 * 1. Pull active fans → upsert into Fan table
 * 2. Pull transactions (last 30 days) → upsert into Transaction table
 * 3. Update Fan.lastPurchaseAt from most recent transaction
 *
 * This is the persistent memory — every agency, every creator, every fan.
 */
export async function POST(request: Request) {
    // Auth guard — require secret header to prevent unauthorized syncs
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

    try {
        // Get all linked creators
        const creators = await prisma.creator.findMany({
            where: {
                AND: [
                    { ofapiToken: { not: null } },
                    { ofapiToken: { not: "unlinked" } },
                ],
            },
        });

        if (creators.length === 0) {
            return NextResponse.json({ error: "No linked creators found" }, { status: 404 });
        }

        const results: any[] = [];

        for (const creator of creators) {
            const accountName = creator.ofapiCreatorId || creator.telegramId;
            const creatorResult: any = {
                creatorId: creator.id,
                name: creator.name || accountName,
                fansUpserted: 0,
                txUpserted: 0,
                errors: [] as string[],
            };

            // --- 1. Sync Fans ---
            try {
                const fansRes = await getActiveFans(accountName, apiKey);
                // OFAPI returns { data: [...fans] } or { list: [...] } or array directly
                const fans: any[] = fansRes?.data?.list || fansRes?.data || fansRes?.list || (Array.isArray(fansRes) ? fansRes : []);

                for (const fan of fans) {
                    const fanId = fan.id?.toString();
                    if (!fanId) continue;

                    try {
                        await prisma.fan.upsert({
                            where: { ofapiFanId: fanId },
                            update: {
                                name: fan.name || fan.displayName || undefined,
                                username: fan.username || undefined,
                                updatedAt: new Date(),
                            },
                            create: {
                                ofapiFanId: fanId,
                                creatorId: creator.id,
                                name: fan.name || fan.displayName || null,
                                username: fan.username || null,
                                lifetimeSpend: fan.subscribedOnData?.totalSumm || 0,
                            },
                        });
                        creatorResult.fansUpserted++;
                    } catch (e: any) {
                        // Skip individual fan errors
                        creatorResult.errors.push(`Fan ${fanId}: ${e.message}`);
                    }
                }
            } catch (e: any) {
                creatorResult.errors.push(`Fan sync failed: ${e.message}`);
            }

            // --- 2. Sync Transactions (last 30 days) ---
            try {
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const transactions = await fetchAllTransactions(accountName, apiKey, thirtyDaysAgo, 3000);

                for (const tx of transactions) {
                    const txId = tx.id?.toString();
                    if (!txId) continue;

                    // Find or create the fan for this transaction
                    const txFanId = tx.user?.id?.toString();
                    if (!txFanId) continue;

                    try {
                        // Ensure fan exists
                        let fan = await prisma.fan.findUnique({ where: { ofapiFanId: txFanId } });
                        if (!fan) {
                            fan = await prisma.fan.create({
                                data: {
                                    ofapiFanId: txFanId,
                                    creatorId: creator.id,
                                    name: tx.user?.name || tx.user?.displayName || null,
                                    username: tx.user?.username || null,
                                    lifetimeSpend: 0,
                                },
                            });
                        }

                        // Upsert transaction
                        const txDate = new Date(tx.createdAt || tx.date || new Date());
                        const txAmount = Math.abs(Number(tx.amount) || 0);
                        const txType = tx.type || tx.description || "unknown";

                        await prisma.transaction.upsert({
                            where: { ofapiTxId: txId },
                            update: {
                                amount: txAmount,
                                type: txType,
                                date: txDate,
                                creatorId: creator.id,
                            },
                            create: {
                                ofapiTxId: txId,
                                fanId: fan.id,
                                creatorId: creator.id,
                                amount: txAmount,
                                type: txType,
                                date: txDate,
                            },
                        });
                        creatorResult.txUpserted++;
                    } catch (e: any) {
                        // Skip individual tx errors
                    }
                }
            } catch (e: any) {
                creatorResult.errors.push(`Transaction sync failed: ${e.message}`);
            }

            // --- 3. Update lastPurchaseAt for all fans of this creator ---
            try {
                // Get the most recent transaction per fan
                const latestTxPerFan = await prisma.$queryRaw<any[]>`
                    SELECT "fanId", MAX("date") as "lastDate",
                           (SELECT "type" FROM "Transaction" t2 WHERE t2."fanId" = t."fanId" ORDER BY "date" DESC LIMIT 1) as "lastType",
                           (SELECT "amount" FROM "Transaction" t2 WHERE t2."fanId" = t."fanId" ORDER BY "date" DESC LIMIT 1) as "lastAmount"
                    FROM "Transaction" t
                    WHERE "creatorId" = ${creator.id}
                    GROUP BY "fanId"
                `;

                for (const row of latestTxPerFan) {
                    await prisma.fan.update({
                        where: { id: row.fanId },
                        data: {
                            lastPurchaseAt: row.lastDate,
                            lastPurchaseType: row.lastType,
                            lastPurchaseAmount: Number(row.lastAmount) || 0,
                        },
                    });
                }

                // Also update lifetimeSpend from sum of transactions
                const spendPerFan = await prisma.$queryRaw<any[]>`
                    SELECT "fanId", SUM("amount") as "totalSpend"
                    FROM "Transaction"
                    WHERE "creatorId" = ${creator.id}
                    GROUP BY "fanId"
                `;

                for (const row of spendPerFan) {
                    await prisma.fan.update({
                        where: { id: row.fanId },
                        data: { lifetimeSpend: Number(row.totalSpend) || 0 },
                    });
                }
            } catch (e: any) {
                creatorResult.errors.push(`lastPurchaseAt update failed: ${e.message}`);
            }

            results.push(creatorResult);
        }

        // Summary
        const totalFans = results.reduce((sum, r) => sum + r.fansUpserted, 0);
        const totalTx = results.reduce((sum, r) => sum + r.txUpserted, 0);

        return NextResponse.json({
            success: true,
            summary: {
                creators: creators.length,
                totalFansUpserted: totalFans,
                totalTransactionsUpserted: totalTx,
            },
            details: results,
        });
    } catch (e: any) {
        console.error("Sync error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * GET /api/sync — Check sync status / last sync info
 */
export async function GET() {
    try {
        const fanCount = await prisma.fan.count();
        const txCount = await prisma.transaction.count();
        const recentBuyers = await prisma.fan.count({
            where: {
                lastPurchaseAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
            },
        });
        const creatorsLinked = await prisma.creator.count({
            where: {
                AND: [
                    { ofapiToken: { not: null } },
                    { ofapiToken: { not: "unlinked" } },
                ],
            },
        });

        return NextResponse.json({
            fanCount,
            transactionCount: txCount,
            recentBuyers30min: recentBuyers,
            creatorsLinked,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

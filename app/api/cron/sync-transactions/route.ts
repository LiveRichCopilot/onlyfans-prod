import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * Cron job that syncs transactions from OFAPI into the local Postgres DB.
 * Run every hour via Vercel Cron. Builds local history so dashboard
 * can query without hitting OFAPI for every page load.
 *
 * Only syncs the last 24h of transactions each run.
 * Uses ofapiTxId for deduplication — safe to run repeatedly.
 */
export async function GET(req: Request) {
    if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === "production") {
            return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    try {
        const creators = await prisma.creator.findMany({
            where: { ofapiToken: { not: null } },
        });

        if (creators.length === 0) {
            return NextResponse.json({ status: "no_creators" });
        }

        let totalSynced = 0;
        let totalSkipped = 0;

        for (const creator of creators) {
            if (!creator.ofapiToken || creator.ofapiToken === "unlinked") continue;

            const accountName = creator.ofapiCreatorId || creator.telegramId;
            const apiKey = creator.ofapiToken;
            const startWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

            try {
                const allTx = await fetchAllTransactions(accountName, apiKey, startWindow, 2000);

                for (const tx of allTx) {
                    const txId = tx.id?.toString() || tx.transaction_id?.toString();
                    if (!txId) continue;

                    const amount = parseFloat(tx.amount || tx.total || "0");
                    if (amount === 0) continue;

                    const fanId = tx.user?.id?.toString() || tx.fan?.id?.toString();
                    const fanUsername = tx.user?.username || tx.fan?.username || "unknown";
                    const fanName = tx.user?.name || tx.user?.displayName || tx.fan?.name || "Unknown";
                    const txDate = new Date(tx.createdAt || tx.created_at || tx.date);

                    if (!fanId) continue;

                    // Upsert fan
                    const fan = await prisma.fan.upsert({
                        where: { ofapiFanId: fanId },
                        create: {
                            ofapiFanId: fanId,
                            creatorId: creator.id,
                            name: fanName,
                            lifetimeSpend: amount,
                        },
                        update: {
                            name: fanName,
                            // lifetimeSpend gets recalculated below
                        },
                    });

                    // Upsert transaction (dedup by ofapiTxId)
                    try {
                        await prisma.transaction.upsert({
                            where: { ofapiTxId: txId },
                            create: {
                                ofapiTxId: txId,
                                fanId: fan.id,
                                amount,
                                date: txDate,
                            },
                            update: {}, // Already exists, skip
                        });
                        totalSynced++;
                    } catch {
                        totalSkipped++; // Duplicate, already exists
                    }
                }

                // Recalculate lifetime spend for all fans of this creator
                const fans = await prisma.fan.findMany({
                    where: { creatorId: creator.id },
                    include: { transactions: true },
                });

                for (const fan of fans) {
                    const total = fan.transactions.reduce((sum, t) => sum + t.amount, 0);
                    await prisma.fan.update({
                        where: { id: fan.id },
                        data: { lifetimeSpend: total },
                    });
                }
            } catch (err: any) {
                console.error(`Sync failed for ${creator.name || accountName}: ${err.message}`);
            }
        }

        return NextResponse.json({
            status: "ok",
            synced: totalSynced,
            skipped: totalSkipped,
            creators: creators.length,
        });
    } catch (err: any) {
        console.error("Transaction sync cron error:", err);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

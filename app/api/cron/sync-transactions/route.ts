import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * Syncs transactions from OFAPI into local Postgres (Supabase).
 * Runs every 30 min via Vercel Cron.
 *
 * Default: syncs last 48h (overlap for safety).
 * With ?backfill=true: syncs last 30 days (one-time historical load).
 *
 * Deduplicates by ofapiTxId. Safe to run repeatedly.
 */
export async function GET(req: NextRequest) {
    if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === "production") {
            return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    const backfill = req.nextUrl.searchParams.get("backfill") === "true";
    const hoursBack = backfill ? 30 * 24 : 48; // 30 days or 48 hours
    const maxTx = backfill ? 10000 : 3000;

    try {
        const creators = await prisma.creator.findMany({
            where: { ofapiToken: { not: null } },
        });

        if (creators.length === 0) {
            return NextResponse.json({ status: "no_creators" });
        }

        let totalSynced = 0;
        let totalSkipped = 0;
        const errors: string[] = [];

        for (const creator of creators) {
            if (!creator.ofapiToken || creator.ofapiToken === "unlinked") continue;

            const accountName = creator.ofapiCreatorId || creator.telegramId;
            const apiKey = creator.ofapiToken;
            const startWindow = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

            try {
                const allTx = await fetchAllTransactions(accountName, apiKey, startWindow, maxTx);

                for (const tx of allTx) {
                    const txId = tx.id?.toString() || tx.transaction_id?.toString();
                    if (!txId) continue;

                    const amount = parseFloat(tx.amount || tx.total || "0");
                    if (amount === 0) continue;

                    const fanId = tx.user?.id?.toString() || tx.fan?.id?.toString();
                    const fanUsername = tx.user?.username || tx.fan?.username || null;
                    const fanName = tx.user?.name || tx.user?.displayName || tx.fan?.name || "Unknown";
                    const txDate = new Date(tx.createdAt || tx.created_at || tx.date);
                    const txType = tx.type || tx.transactionType || tx.transaction_type || null;

                    if (!fanId) continue;

                    // Upsert fan (with username now)
                    const fan = await prisma.fan.upsert({
                        where: { ofapiFanId: fanId },
                        create: {
                            ofapiFanId: fanId,
                            creatorId: creator.id,
                            name: fanName,
                            username: fanUsername,
                            lifetimeSpend: amount,
                        },
                        update: {
                            name: fanName,
                            username: fanUsername || undefined,
                        },
                    });

                    // Upsert transaction (dedup by ofapiTxId)
                    try {
                        await prisma.transaction.upsert({
                            where: { ofapiTxId: txId },
                            create: {
                                ofapiTxId: txId,
                                fanId: fan.id,
                                creatorId: creator.id,
                                amount,
                                type: txType,
                                date: txDate,
                            },
                            update: {
                                creatorId: creator.id, // Backfill for old rows
                                type: txType || undefined,
                            },
                        });
                        totalSynced++;
                    } catch {
                        totalSkipped++;
                    }
                }

                // Recalculate lifetime spend for fans of this creator
                const fansWithTx = await prisma.fan.findMany({
                    where: { creatorId: creator.id },
                    include: { transactions: { select: { amount: true } } },
                });

                for (const fan of fansWithTx) {
                    const total = fan.transactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
                    if (Math.abs(total - fan.lifetimeSpend) > 0.01) {
                        await prisma.fan.update({
                            where: { id: fan.id },
                            data: { lifetimeSpend: total },
                        });
                    }
                }
            } catch (err: any) {
                const msg = `Sync failed for ${creator.name || accountName}: ${err.message}`;
                console.error(msg);
                errors.push(msg);
            }
        }

        return NextResponse.json({
            status: "ok",
            mode: backfill ? "backfill_30d" : "standard_48h",
            synced: totalSynced,
            skipped: totalSkipped,
            creators: creators.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err: any) {
        console.error("Transaction sync cron error:", err);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllTransactions, getActiveFans, fetchAllExpiredFans } from "@/lib/ofapi";
import { updateFanComputedFields } from "@/lib/fan-computed-fields";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/cron/sync-transactions — Sync ALL creators per invocation
 *
 * Runs every 5 min via Vercel Cron.
 * Syncs fans + transactions (24h lookback) for ALL active creators.
 *
 * ?creatorId=xxx — force sync a specific creator only (for manual/debug)
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

    const globalApiKey = process.env.OFAPI_API_KEY;
    if (!globalApiKey) {
        return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
    }

    const startTime = Date.now();
    const backfill = req.nextUrl.searchParams.get("backfill") === "true";
    const forceCreatorId = req.nextUrl.searchParams.get("creatorId");
    const hoursBack = backfill ? 30 * 24 : 24;
    const maxTx = backfill ? 5000 : 500; // Lower per-creator limit when syncing all

    try {
        let creators: any[];

        if (forceCreatorId) {
            const c = await prisma.creator.findUnique({ where: { id: forceCreatorId } });
            creators = c ? [c] : [];
        } else {
            // Order by least recently synced — ensures all creators get fair rotation
            creators = await prisma.creator.findMany({
                where: {
                    AND: [
                        { ofapiToken: { not: null } },
                        { ofapiToken: { not: "unlinked" } },
                    ],
                },
                orderBy: { lastSyncCursor: "asc" },
            });
        }

        if (creators.length === 0) {
            return NextResponse.json({ status: "no_creators_to_sync" });
        }

        const allResults: any[] = [];

        for (const creator of creators) {
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            continue;
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;
        // Use per-creator token when available, fall back to global key
        const apiKey = (creator.ofapiToken && creator.ofapiToken !== "unlinked") ? creator.ofapiToken : globalApiKey;
        const timing: Record<string, number> = {};
        const result = {
            creatorId: creator.id,
            name: creator.name || creator.ofUsername || accountName,
            fansUpserted: 0,
            expiredFansUpserted: 0,
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

            const validFans = fans.filter((f: any) => f.id);

            if (validFans.length > 0) {
                t0 = Date.now();
                // Create new fans (skip existing)
                const fanRecords = validFans.map((f: any) => ({
                    ofapiFanId: f.id.toString(),
                    creatorId: creator.id,
                    name: f.name || f.displayName || null,
                    username: f.username || null,
                    lifetimeSpend: f.subscribedOnData?.totalSumm || 0,
                }));
                const created = await prisma.fan.createMany({
                    data: fanRecords,
                    skipDuplicates: true,
                });
                result.fansUpserted = created.count;

                // Update ALL fans with full OFAPI spending breakdowns + sub status
                for (const f of validFans) {
                    const s = f.subscribedOnData || {};
                    try { await prisma.fan.update({ where: { ofapiFanId: f.id.toString() }, data: {
                        name: f.name || f.displayName || undefined, username: f.username || undefined,
                        lifetimeSpend: s.totalSumm || 0, tipsTotal: s.tipsSumm || 0,
                        subscriptionSpend: s.subscribesSumm || 0, messageSpend: s.messagesSumm || 0,
                        postSpend: s.postsSumm || 0, subscribedAt: s.subscribeAt ? new Date(s.subscribeAt) : undefined,
                        subscriptionStatus: "active", subscriptionPrice: s.subscribePrice || s.regularPrice || undefined,
                    }}); } catch { /* skip */ }
                }
                timing.fansWriteMs = Date.now() - t0;
            }
        } catch (e: any) {
            result.errors.push(`Fan sync: ${e.message}`);
        }

        // --- 1b. Sync Expired Fans (churned but still reachable + can still buy) ---
        t0 = Date.now();
        try {
            const expiredFans = await fetchAllExpiredFans(accountName, apiKey, 10); // up to 200 expired fans
            timing.expiredFansFetchMs = Date.now() - t0;

            if (expiredFans.length > 0) {
                t0 = Date.now();
                const expiredRecords = expiredFans.filter((f: any) => f.id).map((f: any) => ({
                    ofapiFanId: f.id.toString(),
                    creatorId: creator.id,
                    name: f.name || f.displayName || null,
                    username: f.username || null,
                    lifetimeSpend: f.subscribedOnData?.totalSumm || 0,
                }));
                const created = await prisma.fan.createMany({ data: expiredRecords, skipDuplicates: true });
                result.expiredFansUpserted = created.count;

                // Update expired fans with spending + mark as expired
                for (const f of expiredFans.filter((f: any) => f.id)) {
                    const s = f.subscribedOnData || {};
                    try { await prisma.fan.update({ where: { ofapiFanId: f.id.toString() }, data: {
                        name: f.name || f.displayName || undefined, username: f.username || undefined,
                        lifetimeSpend: s.totalSumm || 0, tipsTotal: s.tipsSumm || 0,
                        subscriptionSpend: s.subscribesSumm || 0, messageSpend: s.messagesSumm || 0,
                        postSpend: s.postsSumm || 0,
                        subscribedAt: s.subscribeAt ? new Date(s.subscribeAt) : undefined,
                        subscriptionStatus: "expired",
                        subscriptionPrice: s.subscribePrice || s.regularPrice || undefined,
                        lastActiveAt: s.lastActivity ? new Date(s.lastActivity) : undefined,
                    }}); } catch { /* skip */ }
                }

                // Store expired fan count on creator
                await prisma.creator.update({
                    where: { id: creator.id },
                    data: { expiredFanCount: expiredFans.length },
                });
                timing.expiredFansWriteMs = Date.now() - t0;
            }
        } catch (e: any) {
            result.errors.push(`Expired fan sync: ${e.message}`);
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
                        // Preserve original sign: negative = chargeback/refund
                        amount: Number(tx.price || tx.gross || tx.amount) || 0,
                        type: ((tx.type || tx.description || "unknown").replace(/<[^>]*>/g, "").replace(/&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 50).replace(/[\uD800-\uDFFF]/g, "").trim()) || "unknown",
                        date: new Date(tx.createdAt || tx.date || new Date()),
                    }))
                    .filter((tx: any) => tx.amount !== 0);

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

        // --- 3+4. Update computed fields (bulk SQL — extracted to helper) ---
        t0 = Date.now();
        const fieldErrors = await updateFanComputedFields(prisma, creator.id);
        result.errors.push(...fieldErrors);
        timing.computedFieldsMs = Date.now() - t0;
        result.computedFieldsUpdated = fieldErrors.length === 0 ? 1 : 0;

        // --- 5. Mark sync time ---
        await prisma.creator.update({
            where: { id: creator.id },
            data: { lastSyncCursor: new Date().toISOString() },
        });

        const creatorElapsed = Date.now() - startTime;
        console.log(`[Cron Sync] ${result.name}: ${result.fansUpserted} active, ${result.expiredFansUpserted} expired, ${result.txUpserted} tx (${Math.round(creatorElapsed / 1000)}s total)`, timing, result.errors.length > 0 ? result.errors : "");
        allResults.push(result);

        // Safety: if we're running long, stop and finish the rest next cycle
        if (Date.now() - startTime > 100000) {
            console.log(`[Cron Sync] Time limit reached after ${allResults.length}/${creators.length} creators`);
            break;
        }

        } // end for-each creator

        const durationMs = Date.now() - startTime;
        return NextResponse.json({
            status: "ok",
            mode: backfill ? "backfill_30d" : "standard_24h",
            creatorsProcessed: allResults.length,
            totalCreators: creators.length,
            durationMs,
            results: allResults,
        });
    } catch (err: any) {
        console.error("Cron sync error:", err.message);
        return NextResponse.json({ error: err.message, durationMs: Date.now() - startTime }, { status: 500 });
    }
}

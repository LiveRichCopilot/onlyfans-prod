/**
 * Debug sync-test helpers — simulation and fix logic
 * Extracted from /api/debug/sync-test to keep route under 400 lines.
 */

import { prisma } from "@/lib/prisma";

/**
 * Simulate what the cron sync would do with these OFAPI transactions.
 * No writes — just diagnostic analysis.
 */
export async function simulateCronSync(creatorId: string, ofapiTxs: any[]) {
    const simulation: any = { steps: [], errors: [] };
    try {
        const incomingTxIds = ofapiTxs.map((tx: any) => tx.id?.toString()).filter(Boolean);
        simulation.steps.push({ step: "A_incoming", total: ofapiTxs.length, withValidId: incomingTxIds.length });

        const existingTx = incomingTxIds.length > 0
            ? await prisma.transaction.findMany({
                where: { ofapiTxId: { in: incomingTxIds } },
                select: { ofapiTxId: true },
            })
            : [];
        const existingSet = new Set(existingTx.map((t) => t.ofapiTxId));
        const newTxIds = incomingTxIds.filter((id) => !existingSet.has(id));
        simulation.steps.push({ step: "B_dedup", alreadyInDb: existingSet.size, wouldBeNew: newTxIds.length });

        const newTxs = ofapiTxs.filter((tx: any) => newTxIds.includes(tx.id?.toString()));
        const noUser = newTxs.filter((tx: any) => !tx.user?.id);
        const noAmount = newTxs.filter((tx: any) => Math.abs(Number(tx.amount) || 0) <= 0);
        const passesAllFilters = newTxs.filter((tx: any) => {
            return !!tx.id && !!tx.user?.id && Math.abs(Number(tx.amount) || 0) > 0;
        });
        simulation.steps.push({
            step: "C_filters", newTxCount: newTxs.length,
            filteredOut_noUser: noUser.length, filteredOut_noAmount: noAmount.length,
            wouldInsert: passesAllFilters.length,
            sampleNew: passesAllFilters.slice(0, 3).map((tx: any) => ({
                id: tx.id, amount: tx.amount, createdAt: tx.createdAt, userId: tx.user?.id,
            })),
        });

        const newFanIds = [...new Set(passesAllFilters.map((tx: any) => tx.user.id.toString()))];
        const existingFans = newFanIds.length > 0
            ? await prisma.fan.findMany({
                where: { ofapiFanId: { in: newFanIds } },
                select: { id: true, ofapiFanId: true, creatorId: true },
            })
            : [];
        const fanMap = new Map(existingFans.map((f) => [f.ofapiFanId, f]));
        const missingFanIds = newFanIds.filter((id) => !fanMap.has(id));
        simulation.steps.push({
            step: "D_fanLookup", uniqueNewFans: newFanIds.length,
            existingFansFound: existingFans.length, missingFans: missingFanIds.length,
            missingFanSample: missingFanIds.slice(0, 5),
        });

        const canInsertCount = passesAllFilters.filter((tx: any) => fanMap.has(tx.user.id.toString())).length;
        const blockedByMissingFan = passesAllFilters.length - canInsertCount;
        simulation.steps.push({
            step: "E_verdict", canInsertNow: canInsertCount, blockedByMissingFan,
            wouldInsertAfterFanCreation: passesAllFilters.length,
            verdict: passesAllFilters.length === 0
                ? "No new transactions to insert (all duplicates or filtered out)"
                : blockedByMissingFan > 0
                    ? `${blockedByMissingFan} tx blocked by missing Fan records — cron should create them but may be failing silently`
                    : `${canInsertCount} tx should insert — if cron shows 0, check Prisma errors in Vercel logs`,
        });
    } catch (e: any) {
        simulation.errors.push(e.message);
    }
    return simulation;
}

/**
 * Attempt actual transaction insert — replicates cron logic.
 */
export async function attemptFixInsert(creatorId: string, ofapiTxs: any[]) {
    const fixResult: any = { attempted: true };
    try {
        const allFanIds = [...new Set(
            ofapiTxs.map((tx: any) => tx.user?.id?.toString()).filter(Boolean)
        )];
        const existingFans = await prisma.fan.findMany({
            where: { ofapiFanId: { in: allFanIds } },
            select: { id: true, ofapiFanId: true },
        });
        const fanMap = new Map(existingFans.map((f) => [f.ofapiFanId, f.id]));

        const missingFanIds = allFanIds.filter((id) => !fanMap.has(id));
        if (missingFanIds.length > 0) {
            const missingFanData = missingFanIds.map((fanId) => {
                const tx = ofapiTxs.find((t: any) => t.user?.id?.toString() === fanId);
                return {
                    ofapiFanId: fanId, creatorId,
                    name: tx?.user?.name || tx?.user?.displayName || null,
                    username: tx?.user?.username || null, lifetimeSpend: 0,
                };
            });
            await prisma.fan.createMany({ data: missingFanData, skipDuplicates: true });
            const newFans = await prisma.fan.findMany({
                where: { ofapiFanId: { in: missingFanIds } },
                select: { id: true, ofapiFanId: true },
            });
            for (const f of newFans) fanMap.set(f.ofapiFanId, f.id);
        }
        fixResult.fansCreated = missingFanIds.length;

        const txRecords = ofapiTxs
            .filter((tx: any) => tx.id?.toString() && tx.user?.id?.toString() && fanMap.has(tx.user.id.toString()))
            .map((tx: any) => ({
                ofapiTxId: tx.id.toString(),
                fanId: fanMap.get(tx.user.id.toString())!,
                creatorId,
                amount: Math.abs(Number(tx.price || tx.gross || tx.amount) || 0),
                type: ((tx.type || tx.description || "unknown").replace(/<[^>]*>/g, "").replace(/&(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 50).replace(/[\uD800-\uDFFF]/g, "").trim()) || "unknown",
                date: new Date(tx.createdAt || tx.date || new Date()),
            }))
            .filter((tx: any) => tx.amount > 0);

        fixResult.txPrepared = txRecords.length;

        if (txRecords.length > 0) {
            let totalCreated = 0;
            let batchFailed = false;
            try {
                for (let i = 0; i < txRecords.length; i += 500) {
                    const chunk = txRecords.slice(i, i + 500);
                    const created = await prisma.transaction.createMany({ data: chunk, skipDuplicates: true });
                    totalCreated += created.count;
                }
            } catch (batchErr: any) {
                batchFailed = true;
                fixResult.batchError = batchErr.message;
                const failures: any[] = [];
                totalCreated = 0;
                for (const tx of txRecords) {
                    try {
                        await prisma.transaction.create({ data: tx });
                        totalCreated++;
                    } catch (singleErr: any) {
                        const fieldScan: Record<string, any> = {};
                        for (const [key, val] of Object.entries(tx)) {
                            if (typeof val === "string") {
                                fieldScan[key] = {
                                    length: val.length, preview: val.slice(0, 120),
                                    hex: Buffer.from(val, "utf-8").toString("hex").slice(0, 200),
                                    hasSurrogates: /[\uD800-\uDFFF]/.test(val),
                                    hasBackslashX: /\\x/i.test(val),
                                };
                            }
                        }
                        failures.push({
                            ofapiTxId: tx.ofapiTxId, error: singleErr.message?.slice(0, 300),
                            errorCode: singleErr.code, fieldScan,
                        });
                        if (failures.length >= 5) break;
                    }
                }
                fixResult.fallbackMode = "one-at-a-time";
                fixResult.failures = failures;
            }
            fixResult.txInserted = totalCreated;
            fixResult.success = totalCreated > 0;
            fixResult.batchWasUsed = !batchFailed;
        } else {
            fixResult.txInserted = 0;
            fixResult.success = false;
            fixResult.reason = "No valid transaction records after filtering";
        }
    } catch (e: any) {
        fixResult.success = false;
        fixResult.error = e.message;
        fixResult.errorCode = e.code;
        fixResult.errorMeta = e.meta;
    }
    return fixResult;
}

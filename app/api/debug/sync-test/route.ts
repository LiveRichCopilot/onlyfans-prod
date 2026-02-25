import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/sync-test?creatorId=xxx
 * Diagnoses why a creator shows $0.00 on dashboard.
 */
export async function GET(req: NextRequest) {
    const creatorId = req.nextUrl.searchParams.get("creatorId");
    if (!creatorId) {
        return NextResponse.json({ error: "Missing ?creatorId=xxx" }, { status: 400 });
    }

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "No OFAPI_API_KEY" }, { status: 500 });
    }

    try {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) {
            return NextResponse.json({ error: "Creator not found" }, { status: 404 });
        }

        if (!creator.ofapiCreatorId) {
            return NextResponse.json({ error: "Creator has no ofapiCreatorId — cannot sync" }, { status: 400 });
        }

        const account = creator.ofapiCreatorId;

        // --- 1. Timezone check: reproduce EXACT dashboard logic ---
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const todayStart = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), 0, 0, 0, 0);
        const ukOffset = ukNow.getTime() - now.getTime();
        const todayStartUtc = new Date(todayStart.getTime() - ukOffset);

        // --- 2. Raw OFAPI single-page fetch (see exact response shape) ---
        let rawResponse: any = null;
        let rawError: string | null = null;
        try {
            const res = await fetch(
                `https://app.onlyfansapi.com/api/${account}/transactions?limit=10&startDate=-1day`,
                { headers: { Authorization: `Bearer ${apiKey}` } }
            );
            const body = res.ok ? await res.json() : await res.text();
            rawResponse = {
                status: res.status,
                ok: res.ok,
                topLevelKeys: typeof body === "object" ? Object.keys(body) : null,
                dataType: typeof body?.data,
                dataIsArray: Array.isArray(body?.data),
                hasDataList: !!body?.data?.list,
                hasList: !!body?.list,
                hasTransactions: !!body?.transactions,
                dataKeys: body?.data && typeof body.data === "object" && !Array.isArray(body.data)
                    ? Object.keys(body.data) : null,
                itemCount: body?.data?.list?.length ?? body?.list?.length ?? (Array.isArray(body?.data) ? body.data.length : 0),
                sampleTx: body?.data?.list?.[0] || body?.list?.[0] || (Array.isArray(body?.data) ? body.data[0] : null) || null,
                hasMore: body?.data?.hasMore ?? body?.hasMore ?? null,
                nextMarker: body?.data?.nextMarker ?? body?.nextMarker ?? null,
                rawBodySnippet: typeof body === "string" ? body.slice(0, 500) : undefined,
            };
        } catch (e: any) {
            rawError = e.message;
        }

        // --- 3. Full paginated fetch (same as cron uses) ---
        const startWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let ofapiTxs: any[] = [];
        let ofapiError: string | null = null;
        try {
            ofapiTxs = await fetchAllTransactions(account, apiKey, startWindow, 500);
        } catch (e: any) {
            ofapiError = e.message;
        }

        // Find newest/oldest safely (don't assume array order)
        const newestOfapi = ofapiTxs.length > 0
            ? ofapiTxs.reduce((a, b) =>
                new Date(a.createdAt ?? a.date).getTime() > new Date(b.createdAt ?? b.date).getTime() ? a : b
              , ofapiTxs[0])
            : null;
        const oldestOfapi = ofapiTxs.length > 0
            ? ofapiTxs.reduce((a, b) =>
                new Date(a.createdAt ?? a.date).getTime() < new Date(b.createdAt ?? b.date).getTime() ? a : b
              , ofapiTxs[0])
            : null;

        // --- 4. DB queries ---
        const totalDbTx = await prisma.transaction.count({ where: { creatorId } });
        const todayDbCount = await prisma.transaction.count({
            where: { creatorId, date: { gte: todayStartUtc } },
        });
        const todayDbSum = await prisma.transaction.aggregate({
            where: { creatorId, date: { gte: todayStartUtc } },
            _sum: { amount: true },
        });
        const last24hCount = await prisma.transaction.count({
            where: { creatorId, date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        const last24hSum = await prisma.transaction.aggregate({
            where: { creatorId, date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            _sum: { amount: true },
        });

        const recentDbTx = await prisma.transaction.findMany({
            where: { creatorId },
            orderBy: { date: "desc" },
            take: 5,
            select: { ofapiTxId: true, amount: true, type: true, date: true },
        });

        // --- 5. Simulate cron sync (minimal, no writes) ---
        const simulation: any = { steps: [], errors: [] };
        try {
            // Step A: How many OFAPI tx have valid IDs?
            const incomingTxIds = ofapiTxs.map((tx: any) => tx.id?.toString()).filter(Boolean);
            simulation.steps.push({ step: "A_incoming", total: ofapiTxs.length, withValidId: incomingTxIds.length });

            // Step B: How many already exist in DB? (ofapiTxId is globally unique)
            const existingTx = incomingTxIds.length > 0
                ? await prisma.transaction.findMany({
                    where: { ofapiTxId: { in: incomingTxIds } },
                    select: { ofapiTxId: true },
                })
                : [];
            const existingSet = new Set(existingTx.map((t) => t.ofapiTxId));
            const newTxIds = incomingTxIds.filter((id) => !existingSet.has(id));
            simulation.steps.push({
                step: "B_dedup",
                alreadyInDb: existingSet.size,
                wouldBeNew: newTxIds.length,
            });

            // Step C: Of the new ones, how many pass cron's filters?
            const newTxs = ofapiTxs.filter((tx: any) => newTxIds.includes(tx.id?.toString()));
            const noUser = newTxs.filter((tx: any) => !tx.user?.id);
            const noAmount = newTxs.filter((tx: any) => {
                const amt = Math.abs(Number(tx.amount) || 0);
                return amt <= 0;
            });
            const passesAllFilters = newTxs.filter((tx: any) => {
                const hasId = !!tx.id;
                const hasUser = !!tx.user?.id;
                const amt = Math.abs(Number(tx.amount) || 0);
                return hasId && hasUser && amt > 0;
            });
            simulation.steps.push({
                step: "C_filters",
                newTxCount: newTxs.length,
                filteredOut_noUser: noUser.length,
                filteredOut_noAmount: noAmount.length,
                wouldInsert: passesAllFilters.length,
                sampleNew: passesAllFilters.slice(0, 3).map((tx: any) => ({
                    id: tx.id,
                    amount: tx.amount,
                    createdAt: tx.createdAt,
                    userId: tx.user?.id,
                })),
            });

            // Step D: Fan lookup — would these users resolve to Fan records?
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
                step: "D_fanLookup",
                uniqueNewFans: newFanIds.length,
                existingFansFound: existingFans.length,
                missingFans: missingFanIds.length,
                missingFanSample: missingFanIds.slice(0, 5),
            });

            // Step E: Verdict
            const canInsertCount = passesAllFilters.filter((tx: any) => fanMap.has(tx.user.id.toString())).length;
            const blockedByMissingFan = passesAllFilters.length - canInsertCount;
            simulation.steps.push({
                step: "E_verdict",
                canInsertNow: canInsertCount,
                blockedByMissingFan,
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

        // --- 6. Gap detection ---
        const newestDbDate = recentDbTx[0]?.date ? new Date(recentDbTx[0].date) : null;
        const newestOfapiDate = newestOfapi?.createdAt
            ? new Date(newestOfapi.createdAt)
            : newestOfapi?.date
                ? new Date(newestOfapi.date)
                : null;
        const gapMs = newestDbDate && newestOfapiDate
            ? (newestOfapiDate.getTime() - newestDbDate.getTime())
            : null;
        const gapHours = gapMs !== null ? Math.round((gapMs / 3600000) * 100) / 100 : null;

        return NextResponse.json({
            creator: {
                id: creator.id,
                name: creator.name,
                ofUsername: creator.ofUsername,
                ofapiCreatorId: account,
                lastSync: creator.lastSyncCursor,
            },
            timezoneCheck: {
                serverNowUtc: now.toISOString(),
                ukNowParsed: ukNow.toISOString(),
                ukOffset_ms: ukOffset,
                todayStartUtc: todayStartUtc.toISOString(),
                hoursSinceUkMidnight: Math.round((now.getTime() - todayStartUtc.getTime()) / 3600000 * 100) / 100,
            },
            ofapi: {
                fetchedCount: ofapiTxs.length,
                error: ofapiError,
                newestTx: newestOfapi ? {
                    id: newestOfapi.id,
                    amount: newestOfapi.amount,
                    price: newestOfapi.price,
                    gross: newestOfapi.gross,
                    createdAt: newestOfapi.createdAt,
                    date: newestOfapi.date,
                    type: newestOfapi.type || newestOfapi.description,
                    user: newestOfapi.user ? { id: newestOfapi.user.id, username: newestOfapi.user.username } : null,
                } : null,
                oldestTx: oldestOfapi ? {
                    id: oldestOfapi.id,
                    createdAt: oldestOfapi.createdAt,
                    date: oldestOfapi.date,
                } : null,
            },
            rawApiShape: {
                error: rawError,
                ...rawResponse,
            },
            database: {
                totalTransactions: totalDbTx,
                todayCount_ukMidnight: todayDbCount,
                todaySum_ukMidnight: todayDbSum._sum.amount || 0,
                last24hCount,
                last24hSum: last24hSum._sum.amount || 0,
                newestInDb: recentDbTx[0] || null,
                recentSample: recentDbTx,
            },
            simulation,
            diagnosis: {
                ofapiReturnsData: ofapiTxs.length > 0,
                dbHasTodayTx: todayDbCount > 0,
                dbHasLast24hTx: last24hCount > 0,
                newestDbDate: newestDbDate?.toISOString() ?? null,
                newestOfapiDate: newestOfapiDate?.toISOString() ?? null,
                gapHours,
                gapDetected: gapMs !== null ? gapMs > 60 * 60 * 1000 : null,
                tzMismatch: last24hCount > 0 && todayDbCount === 0
                    ? "last24h has data but ukMidnight filter shows 0 — timezone math is wrong"
                    : null,
                syncStale: ofapiTxs.length > 0 && last24hCount === 0
                    ? "OFAPI has recent tx but DB has 0 in 24h — sync not inserting"
                    : null,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}

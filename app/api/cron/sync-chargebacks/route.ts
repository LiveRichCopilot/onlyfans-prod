import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChargebacks, getChargebackRatio } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sync-chargebacks — Sync chargebacks for all creators
 *
 * Runs every 30 min via Vercel Cron (or manually).
 * Fetches chargebacks (90-day lookback) + ratio for each creator.
 *
 * ?creatorId=xxx — force sync a specific creator only
 */
export async function GET(req: NextRequest) {
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
    const forceCreatorId = req.nextUrl.searchParams.get("creatorId");

    try {
        let creators: any[];
        if (forceCreatorId) {
            const c = await prisma.creator.findUnique({ where: { id: forceCreatorId } });
            creators = c ? [c] : [];
        } else {
            creators = await prisma.creator.findMany({
                where: {
                    AND: [{ ofapiToken: { not: null } }, { ofapiToken: { not: "unlinked" } }],
                },
                orderBy: { chargebackLastSyncAt: "asc" },
            });
        }

        if (creators.length === 0) {
            return NextResponse.json({ status: "no_creators" });
        }

        const allResults: any[] = [];
        // 90-day lookback for chargebacks
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const startDateStr = startDate.toISOString().replace("T", " ").slice(0, 19);

        for (const creator of creators) {
            if (!creator?.ofapiToken || creator.ofapiToken === "unlinked") continue;

            const accountName = creator.ofapiCreatorId || creator.telegramId;
            const apiKey = (creator.ofapiToken && creator.ofapiToken !== "unlinked") ? creator.ofapiToken : globalApiKey;
            const result = {
                creatorId: creator.id,
                name: creator.name || creator.ofUsername || accountName,
                chargebacksSynced: 0,
                ratio: null as number | null,
                errors: [] as string[],
            };

            // --- 1. Fetch chargebacks (paginated) ---
            try {
                let allCbs: any[] = [];
                let offset = 0;
                for (let page = 0; page < 10; page++) {
                    const res = await getChargebacks(accountName, apiKey, {
                        startDate: startDateStr,
                        limit: 100,
                        offset,
                    }).catch(() => null);
                    if (!res) break;
                    const cbs = res?.data?.list || [];
                    if (cbs.length === 0) break;
                    allCbs.push(...cbs);
                    offset += 100;
                    if (cbs.length < 100) break;
                }

                if (allCbs.length > 0) {
                    const cbRecords = allCbs
                        .filter((cb: any) => cb.id)
                        .map((cb: any) => ({
                            ofapiCbId: cb.id.toString(),
                            creatorId: creator.id,
                            fanOfId: cb.payment?.user?.id?.toString() || null,
                            fanUsername: cb.payment?.user?.username || null,
                            fanName: cb.payment?.user?.name || null,
                            paymentType: cb.paymentType || null,
                            amount: Number(cb.payment?.amount) || 0,
                            vatAmount: Number(cb.payment?.vatAmount) || 0,
                            net: Number(cb.payment?.net) || 0,
                            fee: Number(cb.payment?.fee) || 0,
                            currency: cb.payment?.currency || "USD",
                            description: cb.payment?.description || null,
                            status: cb.payment?.status || null,
                            chargebackAt: new Date(cb.createdAt || new Date()),
                        }));

                    await prisma.chargeback.createMany({
                        data: cbRecords,
                        skipDuplicates: true,
                    });
                    result.chargebacksSynced = cbRecords.length;

                    // Mark fans with chargebackRisk
                    const cbFanIds = [...new Set(cbRecords.map(cb => cb.fanOfId).filter(Boolean))];
                    if (cbFanIds.length > 0) {
                        await prisma.fan.updateMany({
                            where: { ofapiFanId: { in: cbFanIds as string[] }, creatorId: creator.id },
                            data: { chargebackRisk: true },
                        });
                    }

                    // Update creator-level totals
                    const totalAmount = cbRecords.reduce((sum, cb) => sum + cb.amount, 0);
                    await prisma.creator.update({
                        where: { id: creator.id },
                        data: {
                            chargebackTotal: totalAmount,
                            chargebackCount: cbRecords.length,
                        },
                    });
                }
            } catch (e: any) {
                result.errors.push(`Chargebacks: ${e.message}`);
            }

            // --- 2. Fetch chargeback ratio ---
            try {
                const ratioRes = await getChargebackRatio(accountName, apiKey);
                const ratio = ratioRes?.data?.chargebacksRatio;
                if (ratio !== undefined) {
                    result.ratio = ratio;
                    await prisma.creator.update({
                        where: { id: creator.id },
                        data: { chargebackRatio: ratio },
                    });
                }
            } catch (e: any) {
                result.errors.push(`Ratio: ${e.message}`);
            }

            // --- 3. Mark sync time ---
            await prisma.creator.update({
                where: { id: creator.id },
                data: { chargebackLastSyncAt: new Date() },
            });

            console.log(`[Chargeback Sync] ${result.name}: ${result.chargebacksSynced} chargebacks, ratio=${result.ratio}%`, result.errors.length > 0 ? result.errors : "");
            allResults.push(result);

            if (Date.now() - startTime > 50000) {
                console.log(`[Chargeback Sync] Time limit after ${allResults.length}/${creators.length}`);
                break;
            }
        }

        return NextResponse.json({
            status: "ok",
            creatorsProcessed: allResults.length,
            durationMs: Date.now() - startTime,
            results: allResults,
        });
    } catch (err: any) {
        console.error("Chargeback sync error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

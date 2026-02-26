import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listAllFans } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 55; // Vercel cron max

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/online-poll
 * Runs every 2 minutes via Vercel cron.
 *
 * For each active creator:
 * 1. Calls OFAPI listAllFans(online: true) to get currently online fans
 * 2. Compares against cached online fan IDs
 * 3. If a whale ($500+) just came online → logs FanLifecycleEvent
 * 4. Updates Creator.onlineFanCache
 */
export async function GET(request: Request) {
    // Verify cron secret
    if (CRON_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const startTime = Date.now();
        const TIME_BUDGET_MS = 45_000; // Stop well before 55s Vercel limit

        const creators = await prisma.creator.findMany({
            where: { active: true, ofapiToken: { not: null } },
        });

        const eligible = creators.filter(c => c.ofapiToken && c.ofapiCreatorId);

        // Process all creators in parallel
        const settled = await Promise.allSettled(
            eligible.map(async (creator) => {
                if (Date.now() - startTime > TIME_BUDGET_MS) {
                    return { creator: creator.name, skipped: true };
                }

                const onlineData = await listAllFans(
                    creator.ofapiCreatorId!,
                    creator.ofapiToken!,
                    { online: true },
                );

                const onlineFans: any[] = Array.isArray(onlineData?.data)
                    ? onlineData.data
                    : onlineData?.data?.list || [];

                const onlineIds = new Set(onlineFans.map((f: any) => String(f.id)));

                const prevCache = (creator.onlineFanCache as any) || { fanIds: [], whales: [] };
                const prevIds = new Set<string>(prevCache.fanIds || []);

                const newlyOnline = onlineFans.filter(
                    (f: any) => !prevIds.has(String(f.id)),
                );

                const whaleThreshold = creator.whaleAlertTarget || 200;
                const newWhales: any[] = [];

                for (const fan of newlyOnline) {
                    const fanId = String(fan.id);
                    const spend =
                        fan.subscribedOnData?.totalSumm ||
                        fan.totalSpend ||
                        0;

                    if (spend >= whaleThreshold) {
                        newWhales.push({
                            id: fanId,
                            name: fan.name || fan.username || "Anonymous",
                            spend,
                        });

                        const dbFan = await prisma.fan.findFirst({
                            where: { ofapiFanId: fanId, creatorId: creator.id },
                        });

                        if (dbFan) {
                            await prisma.fanLifecycleEvent.create({
                                data: {
                                    fanId: dbFan.id,
                                    type: "whale_online",
                                    metadata: {
                                        name: fan.name,
                                        spend,
                                        creatorName: creator.name,
                                        timestamp: new Date().toISOString(),
                                    },
                                },
                            });
                        }
                    }
                }

                await prisma.creator.update({
                    where: { id: creator.id },
                    data: {
                        onlineFanCache: {
                            fanIds: [...onlineIds],
                            whales: newWhales,
                            lastChecked: new Date().toISOString(),
                        },
                    },
                });

                return {
                    creator: creator.name,
                    onlineCount: onlineIds.size,
                    newlyOnline: newlyOnline.length,
                    newWhales: newWhales.length,
                };
            }),
        );

        const results = settled.map((s, i) =>
            s.status === "fulfilled"
                ? s.value
                : { creator: eligible[i].name, error: (s.reason as Error).message },
        );

        return NextResponse.json({ ok: true, results, durationMs: Date.now() - startTime });
    } catch (e: any) {
        console.error("[Online Poll] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

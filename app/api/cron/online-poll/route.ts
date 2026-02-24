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
        const creators = await prisma.creator.findMany({
            where: { active: true, ofapiToken: { not: null } },
        });

        const results: any[] = [];

        for (const creator of creators) {
            if (!creator.ofapiToken || !creator.ofapiCreatorId) continue;

            try {
                // Fetch online fans from OFAPI
                const onlineData = await listAllFans(
                    creator.ofapiCreatorId,
                    creator.ofapiToken,
                    { online: true },
                );

                const onlineFans: any[] = Array.isArray(onlineData?.data)
                    ? onlineData.data
                    : onlineData?.data?.list || [];

                const onlineIds = new Set(onlineFans.map((f: any) => String(f.id)));

                // Parse previous cache
                const prevCache = (creator.onlineFanCache as any) || { fanIds: [], whales: [] };
                const prevIds = new Set<string>(prevCache.fanIds || []);

                // Find NEW online fans (just came online)
                const newlyOnline = onlineFans.filter(
                    (f: any) => !prevIds.has(String(f.id)),
                );

                // Check which newly online fans are whales
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

                        // Find or create fan in DB
                        const dbFan = await prisma.fan.findFirst({
                            where: { ofapiFanId: fanId, creatorId: creator.id },
                        });

                        if (dbFan) {
                            // Log whale_online lifecycle event
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

                // Update cache
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

                results.push({
                    creator: creator.name,
                    onlineCount: onlineIds.size,
                    newlyOnline: newlyOnline.length,
                    newWhales: newWhales.length,
                });
            } catch (e: any) {
                results.push({
                    creator: creator.name,
                    error: e.message,
                });
            }
        }

        return NextResponse.json({ ok: true, results });
    } catch (e: any) {
        console.error("[Online Poll] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

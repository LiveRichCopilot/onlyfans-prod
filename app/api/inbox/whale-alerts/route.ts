import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/whale-alerts?creatorId=xxx
 *
 * Returns recent whale_online lifecycle events from the last 10 minutes
 * for the selected creator. Used by WhaleOnlineAlert component to show
 * real-time whale notifications in the sidebar.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId) {
        return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });
    }

    try {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

        const events = await prisma.fanLifecycleEvent.findMany({
            where: {
                type: "whale_online",
                createdAt: { gte: tenMinAgo },
                fan: { creatorId },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
                fan: {
                    select: {
                        ofapiFanId: true,
                        name: true,
                        username: true,
                        lifetimeSpend: true,
                        lastPurchaseAt: true,
                    },
                },
            },
        });

        const alerts = events.map((e) => ({
            id: e.id,
            fanOfapiId: e.fan.ofapiFanId,
            name: e.fan.name || e.fan.username || "Anonymous",
            spend: e.fan.lifetimeSpend,
            lastPurchaseAt: e.fan.lastPurchaseAt?.toISOString() || null,
            timestamp: e.createdAt.toISOString(),
            metadata: e.metadata,
        }));

        return NextResponse.json({ alerts });
    } catch (e: any) {
        console.error("[Whale Alerts] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

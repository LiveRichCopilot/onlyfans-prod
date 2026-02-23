import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/performance?userId=xxx
 *
 * Returns today's ChatterPerformance records for a given user (chatter).
 * If no userId, returns all chatters' performance for the dashboard.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const where: any = { date: today };
        if (userId) where.userId = userId;

        const records = await prisma.chatterPerformance.findMany({
            where,
            orderBy: { liveScore: "desc" },
        });

        // Enrich with user and creator names
        const userIds = [...new Set(records.map((r) => r.userId))];
        const creatorIds = [...new Set(records.map((r) => r.creatorId))];

        const [users, creators] = await Promise.all([
            prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, image: true },
            }),
            prisma.creator.findMany({
                where: { id: { in: creatorIds } },
                select: { id: true, name: true, avatarUrl: true },
            }),
        ]);

        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
        const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));

        const enriched = records.map((r) => ({
            ...r,
            userName: userMap[r.userId]?.name || "Unknown",
            userImage: userMap[r.userId]?.image || null,
            creatorName: creatorMap[r.creatorId]?.name || "Unknown",
            creatorAvatar: creatorMap[r.creatorId]?.avatarUrl || null,
        }));

        return NextResponse.json({ performance: enriched });
    } catch (e: any) {
        console.error("[Performance] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

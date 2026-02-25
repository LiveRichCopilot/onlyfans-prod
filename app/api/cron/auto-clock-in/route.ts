import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/auto-clock-in
 *
 * Runs every 5 min via Vercel Cron.
 * Auto-clocks in all scheduled chatters who aren't already live.
 * Sessions are auto-clocked-out by performance-score cron (shift end or 12h max).
 */
export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        const authHeader = req.headers.get("Authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    try {
        // Get all scheduled chatter-creator pairs
        const schedules = await prisma.chatterSchedule.findMany({
            select: { email: true, creatorId: true },
        });

        if (schedules.length === 0) {
            return NextResponse.json({ status: "no_schedules" });
        }

        // Get all currently live sessions
        const liveSessions = await prisma.chatterSession.findMany({
            where: { isLive: true },
            select: { email: true, creatorId: true },
        });
        const liveSet = new Set(liveSessions.map(s => `${s.email}|${s.creatorId}`));

        // Deduplicate schedules to unique (email, creatorId) pairs not already live
        const seen = new Set<string>();
        const toClockIn: { email: string; creatorId: string }[] = [];

        for (const sched of schedules) {
            const key = `${sched.email}|${sched.creatorId}`;
            if (seen.has(key) || liveSet.has(key)) continue;
            seen.add(key);
            toClockIn.push({ email: sched.email, creatorId: sched.creatorId });
        }

        if (toClockIn.length === 0) {
            return NextResponse.json({
                status: "all_clocked_in",
                alreadyLive: liveSessions.length,
            });
        }

        // Clock in missing chatters (isLive defaults to true, clockIn defaults to now())
        const created = await prisma.chatterSession.createMany({
            data: toClockIn,
        });

        console.log(`[Auto Clock-In] Clocked in ${created.count} chatters`);

        return NextResponse.json({
            status: "ok",
            clockedIn: created.count,
            alreadyLive: liveSessions.length,
        });
    } catch (err: any) {
        console.error("Auto clock-in error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

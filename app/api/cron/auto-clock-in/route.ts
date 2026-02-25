import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/auto-clock-in
 *
 * Runs every 5 min via Vercel Cron.
 * Only clocks in chatters whose shift covers the CURRENT UK time.
 * Clocks out chatters whose shift has ended.
 */
export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        const authHeader = req.headers.get("Authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    try {
        const ukHour = getCurrentUKHour();

        // Get all schedules
        const schedules = await prisma.chatterSchedule.findMany({
            select: { email: true, creatorId: true, shift: true },
        });

        if (schedules.length === 0) {
            return NextResponse.json({ status: "no_schedules", ukHour });
        }

        // Filter to only schedules active right now
        const activeSchedules = schedules.filter(s => isShiftActive(s.shift, ukHour));

        // Get all currently live sessions
        const liveSessions = await prisma.chatterSession.findMany({
            where: { isLive: true },
            select: { id: true, email: true, creatorId: true },
        });
        const liveSet = new Set(liveSessions.map(s => `${s.email}|${s.creatorId}`));
        const activeSet = new Set(activeSchedules.map(s => `${s.email}|${s.creatorId}`));

        // Clock OUT chatters who are live but NOT on an active shift
        let clockedOut = 0;
        for (const session of liveSessions) {
            const key = `${session.email}|${session.creatorId}`;
            if (!activeSet.has(key)) {
                await prisma.chatterSession.update({
                    where: { id: session.id },
                    data: { isLive: false, clockOut: new Date() },
                });
                clockedOut++;
            }
        }

        // Clock IN chatters who should be active but aren't live
        const seen = new Set<string>();
        const toClockIn: { email: string; creatorId: string }[] = [];

        for (const sched of activeSchedules) {
            const key = `${sched.email}|${sched.creatorId}`;
            if (seen.has(key) || liveSet.has(key)) continue;
            seen.add(key);
            toClockIn.push({ email: sched.email, creatorId: sched.creatorId });
        }

        let clockedIn = 0;
        if (toClockIn.length > 0) {
            const created = await prisma.chatterSession.createMany({ data: toClockIn });
            clockedIn = created.count;
        }

        console.log(`[Auto Clock-In] UK ${ukHour}:00 | In: ${clockedIn} | Out: ${clockedOut} | Active: ${activeSchedules.length} | Live: ${liveSessions.length}`);

        return NextResponse.json({
            status: "ok",
            ukHour,
            clockedIn,
            clockedOut,
            activeSchedules: activeSchedules.length,
            previouslyLive: liveSessions.length,
        });
    } catch (err: any) {
        console.error("Auto clock-in error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Get current UK hour (0-23). Handles GMT/BST automatically.
 */
function getCurrentUKHour(): number {
    const now = new Date();
    const ukFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hour12: false,
    });
    return parseInt(ukFormatter.format(now), 10);
}

/**
 * Check if a shift string like "07:00-15:00" or "23:00-07:00" covers the given UK hour.
 */
function isShiftActive(shift: string | null, ukHour: number): boolean {
    if (!shift) return false;
    const parts = shift.split("-");
    if (parts.length !== 2) return false;

    const startHour = parseInt(parts[0].trim().split(":")[0], 10);
    const endHour = parseInt(parts[1].trim().split(":")[0], 10);
    if (isNaN(startHour) || isNaN(endHour)) return false;

    if (startHour < endHour) {
        // Normal shift: 07:00-15:00
        return ukHour >= startHour && ukHour < endHour;
    } else {
        // Overnight shift: 23:00-07:00
        return ukHour >= startHour || ukHour < endHour;
    }
}

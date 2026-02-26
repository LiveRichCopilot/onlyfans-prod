import { NextResponse } from "next/server";
import { buildScoringWindows, scoreChatter } from "@/lib/chatter-scorer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/performance-score
 *
 * Runs every 30 minutes via Vercel cron.
 * Scores the last fully completed UK hour for each active chatter-creator pair.
 *
 * UK-aligned windows:
 * - Canonical timezone: Europe/London
 * - Score the last completed UK hour (e.g., if now=14:12 UK, score 13:00-14:00 UK)
 * - Store windowStart/windowEnd as UTC in DB
 *
 * Budget: max 3 pairs per run (~17s each, 50s usable, 5s safety margin)
 * Round-robin rotates through pairs across runs.
 */
export async function GET(request: Request) {
    if (CRON_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const startTime = Date.now();

    try {
        // --- Auto-clock-out: schedule-based + max session safety net ---
        const autoClockOutResults = await autoClockOutExpired().catch((e) => {
            console.error("[PerfScore] Auto-clock-out error:", e.message);
            return { scheduled: 0, maxDuration: 0 };
        });

        // Compute UK-aligned hour window boundaries
        const { windowStart, windowEnd } = getLastCompletedUKHour();

        console.log(
            `[PerfScore] Scoring window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`,
        );

        // Build all possible scoring windows (chatter-creator pairs with active sessions)
        const allWindows = await buildScoringWindows(windowStart, windowEnd);

        if (allWindows.length === 0) {
            return NextResponse.json({
                ok: true,
                message: "No active chatter sessions in scoring window",
                window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
            });
        }

        // Pre-filter: skip pairs already scored for this window
        const existingScores = await prisma.chatterHourlyScore.findMany({
            where: { windowStart },
            select: { chatterEmail: true, creatorId: true },
        });
        const scoredSet = new Set(existingScores.map(s => `${s.chatterEmail}::${s.creatorId}`));
        const unscoredWindows = allWindows.filter(
            w => !scoredSet.has(`${w.chatterEmail}::${w.creatorId}`),
        );

        console.log(
            `[PerfScore] ${allWindows.length} total pairs, ${existingScores.length} already scored, ${unscoredWindows.length} remaining`,
        );

        if (unscoredWindows.length === 0) {
            return NextResponse.json({
                ok: true,
                message: "All pairs already scored for this window",
                totalPairs: allWindows.length,
                alreadyScored: existingScores.length,
            });
        }

        const results: Array<{
            chatter: string;
            creator: string;
            score: number | null;
            status: string;
        }> = [];

        const MAX_PAIRS = 10;

        // Shuffle for fairness — prevents same pairs always getting priority
        for (let i = unscoredWindows.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unscoredWindows[i], unscoredWindows[j]] = [unscoredWindows[j], unscoredWindows[i]];
        }

        for (let i = 0; i < Math.min(unscoredWindows.length, MAX_PAIRS); i++) {
            // Time guard: stop with 15s safety margin for DB writes + response
            if (Date.now() - startTime > 100_000) {
                console.log("[PerfScore] Time guard hit — stopping early");
                break;
            }

            const window = unscoredWindows[i];

            try {
                const result = await scoreChatter(window, true);

                results.push({
                    chatter: window.chatterEmail,
                    creator: window.creatorName,
                    score: result?.totalScore ?? null,
                    status: result ? "scored" : "skipped",
                });
            } catch (e: any) {
                results.push({
                    chatter: window.chatterEmail,
                    creator: window.creatorName,
                    score: null,
                    status: `error: ${e.message}`,
                });
            }
        }

        const elapsed = Date.now() - startTime;

        return NextResponse.json({
            ok: true,
            window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
            totalPairs: allWindows.length,
            scored: results.filter((r) => r.status === "scored").length,
            elapsed: `${elapsed}ms`,
            autoClockOut: autoClockOutResults,
            results,
        });
    } catch (e: any) {
        console.error("[PerfScore] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * Get the last fully completed UK hour boundaries as UTC dates.
 *
 * Example: If current UK time is 14:12, returns:
 *   windowStart = 13:00 UK → converted to UTC
 *   windowEnd   = 14:00 UK → converted to UTC
 *
 * Handles BST/GMT transitions via Intl.DateTimeFormat.
 */
function getLastCompletedUKHour(): { windowStart: Date; windowEnd: Date } {
    const now = new Date();

    // Get current UK time components using Intl
    const ukFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    const parts = ukFormatter.formatToParts(now);
    const ukYear = parseInt(parts.find((p) => p.type === "year")!.value);
    const ukMonth = parseInt(parts.find((p) => p.type === "month")!.value) - 1;
    const ukDay = parseInt(parts.find((p) => p.type === "day")!.value);
    const ukHour = parseInt(parts.find((p) => p.type === "hour")!.value);

    // Window end = start of current UK hour (the last completed hour ends here)
    // Window start = one hour before that
    // We need to convert UK local time to UTC

    // Create a date string in UK timezone and parse it back to get UTC offset
    const windowEndUK = new Date(
        Date.UTC(ukYear, ukMonth, ukDay, ukHour, 0, 0, 0),
    );
    const windowStartUK = new Date(
        Date.UTC(ukYear, ukMonth, ukDay, ukHour - 1, 0, 0, 0),
    );

    // Calculate UTC offset for Europe/London at this time
    // The UTC time above represents UK local time, so we need to subtract the UK offset
    const ukOffset = getUKOffsetMs(now);

    const windowStart = new Date(windowStartUK.getTime() - ukOffset);
    const windowEnd = new Date(windowEndUK.getTime() - ukOffset);

    return { windowStart, windowEnd };
}

/**
 * Get the UTC offset for Europe/London in milliseconds.
 * Returns 0 for GMT, 3600000 for BST.
 */
function getUKOffsetMs(date: Date): number {
    // Create a UTC reference and a UK reference, compare them
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const ukStr = date.toLocaleString("en-US", { timeZone: "Europe/London" });
    const utcDate = new Date(utcStr);
    const ukDate = new Date(ukStr);
    return ukDate.getTime() - utcDate.getTime();
}

/**
 * Auto-clock-out chatters based on:
 * 1. Schedule: if shift end time has passed
 * 2. Max duration safety net: any session running >12 hours
 */
async function autoClockOutExpired(): Promise<{ scheduled: number; maxDuration: number }> {
    const now = new Date();
    let scheduledCount = 0;
    let maxDurationCount = 0;

    // Find all live sessions
    const liveSessions = await prisma.chatterSession.findMany({
        where: { isLive: true },
        select: { id: true, email: true, creatorId: true, clockIn: true },
    });

    if (liveSessions.length === 0) return { scheduled: 0, maxDuration: 0 };

    for (const session of liveSessions) {
        // Safety net: auto-clock-out any session >12 hours
        const hoursLive = (now.getTime() - new Date(session.clockIn).getTime()) / 3600000;
        if (hoursLive > 12) {
            await prisma.chatterSession.update({
                where: { id: session.id },
                data: { isLive: false, clockOut: now },
            });
            console.log(`[AutoClockOut] Max duration: ${session.email} (${hoursLive.toFixed(1)}h)`);
            maxDurationCount++;
            continue;
        }

        // Schedule-based: look up ChatterSchedule for this chatter+creator
        const schedule = await prisma.chatterSchedule.findFirst({
            where: { email: session.email, creatorId: session.creatorId },
        });

        if (!schedule?.shift) continue;

        // Parse shift end time from "HH:MM-HH:MM" format
        const shiftParts = schedule.shift.split("-");
        if (shiftParts.length !== 2) continue;

        const endTimeParts = shiftParts[1].trim().split(":");
        if (endTimeParts.length !== 2) continue;

        const endHour = parseInt(endTimeParts[0], 10);
        const endMinute = parseInt(endTimeParts[1], 10);
        if (isNaN(endHour) || isNaN(endMinute)) continue;

        // Build shift end time in UK timezone for today
        const ukOffset = getUKOffsetMs(now);
        const ukNow = new Date(now.getTime() + ukOffset);
        const shiftEndUK = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), endHour, endMinute, 0);
        const shiftEndUtc = new Date(shiftEndUK.getTime() - ukOffset);

        if (now > shiftEndUtc) {
            await prisma.chatterSession.update({
                where: { id: session.id },
                data: { isLive: false, clockOut: now },
            });
            console.log(`[AutoClockOut] Schedule: ${session.email} (shift ended ${schedule.shift})`);
            scheduledCount++;
        }
    }

    return { scheduled: scheduledCount, maxDuration: maxDurationCount };
}

import { NextResponse } from "next/server";
import { buildScoringWindows, scoreChatter } from "@/lib/chatter-scorer";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

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

        // Round-robin: rotate through pairs across cron runs
        const offset = Math.floor(Date.now() / (60 * 60 * 1000)) % allWindows.length;
        const rotated = [...allWindows.slice(offset), ...allWindows.slice(0, offset)];

        const results: Array<{
            chatter: string;
            creator: string;
            score: number | null;
            status: string;
        }> = [];

        const MAX_PAIRS = 3;

        for (let i = 0; i < Math.min(rotated.length, MAX_PAIRS); i++) {
            // Time guard: stop if running low on budget
            if (Date.now() - startTime > 50_000) {
                console.log("[PerfScore] Time guard hit — stopping early");
                break;
            }

            const window = rotated[i];

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

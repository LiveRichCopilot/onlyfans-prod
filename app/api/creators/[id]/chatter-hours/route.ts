import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/creators/[id]/chatter-hours
 *
 * Returns per-chatter, per-hour breakdown for a creator today (UK time).
 * Each chatter shows which hours they were clocked in and their score for that window.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: creatorId } = await params;

        // --- UK day window ---
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const todayStart = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), 0, 0, 0, 0);
        const ukOffset = ukNow.getTime() - now.getTime();
        const todayStartUtc = new Date(todayStart.getTime() - ukOffset);
        const currentHour = ukNow.getHours();

        // --- Fetch chatter sessions for this creator today ---
        const sessions = await prisma.chatterSession.findMany({
            where: {
                creatorId,
                clockIn: { gte: todayStartUtc },
            },
            orderBy: { clockIn: "asc" },
        });

        // --- Fetch hourly scores for this creator today ---
        const scores = await prisma.chatterHourlyScore.findMany({
            where: {
                creatorId,
                windowStart: { gte: todayStartUtc },
            },
            orderBy: { windowStart: "asc" },
        });

        // --- Fetch profiles for display names ---
        const profiles = await prisma.chatterProfile.findMany({
            where: { creatorId },
            select: { chatterEmail: true, chatterName: true },
        });
        const nameMap = new Map(profiles.map((p) => [p.chatterEmail, p.chatterName]));

        // --- Build per-chatter hour grid ---
        const chatterMap = new Map<
            string,
            {
                email: string;
                name: string | null;
                hoursActive: boolean[];
                hourlyScores: (number | null)[];
                hourlyDetails: ({
                    totalScore: number;
                    slaScore: number;
                    followupScore: number;
                    triggerScore: number;
                    qualityScore: number;
                    revenueScore: number;
                    detectedArchetype: string | null;
                    mistakeTags: string[];
                    strengthTags: string[];
                    aiNotes: string | null;
                } | null)[];
                totalScore: number;
                hoursWorked: number;
            }
        >();

        const hoursCount = currentHour + 1;

        function getOrCreate(email: string) {
            let entry = chatterMap.get(email);
            if (!entry) {
                entry = {
                    email,
                    name: nameMap.get(email) || null,
                    hoursActive: new Array(hoursCount).fill(false),
                    hourlyScores: new Array(hoursCount).fill(null),
                    hourlyDetails: new Array(hoursCount).fill(null),
                    totalScore: 0,
                    hoursWorked: 0,
                };
                chatterMap.set(email, entry);
            }
            return entry;
        }

        // Mark active hours from sessions
        for (const session of sessions) {
            const entry = getOrCreate(session.email);
            const clockInUk = new Date(session.clockIn.getTime() + ukOffset);
            const clockOutUk = session.clockOut
                ? new Date(session.clockOut.getTime() + ukOffset)
                : ukNow;

            const startHour = clockInUk.getHours();
            const endHour = clockOutUk.getHours();

            for (let h = startHour; h <= Math.min(endHour, currentHour); h++) {
                if (h >= 0 && h < hoursCount) {
                    entry.hoursActive[h] = true;
                }
            }
        }

        // Layer on scores
        for (const score of scores) {
            const entry = getOrCreate(score.chatterEmail);
            const windowStartUk = new Date(score.windowStart.getTime() + ukOffset);
            const hourIndex = windowStartUk.getHours();

            if (hourIndex >= 0 && hourIndex < hoursCount) {
                entry.hoursActive[hourIndex] = true;
                entry.hourlyScores[hourIndex] = score.totalScore;
                entry.hourlyDetails[hourIndex] = {
                    totalScore: score.totalScore,
                    slaScore: score.slaScore,
                    followupScore: score.followupScore,
                    triggerScore: score.triggerScore,
                    qualityScore: score.qualityScore,
                    revenueScore: score.revenueScore,
                    detectedArchetype: score.detectedArchetype,
                    mistakeTags: score.mistakeTags,
                    strengthTags: score.strengthTags,
                    aiNotes: score.aiNotes,
                };
            }
        }

        // Calculate totals
        for (const entry of chatterMap.values()) {
            const validScores = entry.hourlyScores.filter((s): s is number => s !== null);
            entry.totalScore = validScores.length > 0
                ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                : 0;
            entry.hoursWorked = entry.hoursActive.filter(Boolean).length;
        }

        const chatters = Array.from(chatterMap.values()).sort(
            (a, b) => b.totalScore - a.totalScore
        );

        return NextResponse.json({ currentHour, chatters });
    } catch (error: any) {
        console.error("Chatter hours error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

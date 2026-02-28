import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        // --- Auth & role scoping ---
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role || "UNASSIGNED";
        const userId = (session?.user as any)?.id;

        let allowedCreatorIds: string[] | null = null;

        if (role === "EMPLOYEE" && userId) {
            const assignments = await prisma.creatorAssignment.findMany({
                where: { userId },
                select: { creatorId: true },
            });
            allowedCreatorIds = assignments.map((a) => a.creatorId);
            if (allowedCreatorIds.length === 0) {
                const ukNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
                return NextResponse.json({ currentHour: ukNow.getHours(), creators: [], isToday: true });
            }
        }

        // --- Check for date query param (e.g. ?date=2026-02-25) ---
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date");

        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const ukOffset = ukNow.getTime() - now.getTime();

        let dayStart: Date;
        let dayEnd: Date;
        let currentHour: number;
        let isToday: boolean;

        if (dateParam) {
            // Parse the requested date as UK midnight
            const [year, month, day] = dateParam.split("-").map(Number);
            dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
            dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
            // Check if this is today
            const todayStr = `${ukNow.getFullYear()}-${String(ukNow.getMonth() + 1).padStart(2, "0")}-${String(ukNow.getDate()).padStart(2, "0")}`;
            isToday = dateParam === todayStr;
            currentHour = isToday ? ukNow.getHours() : 23;
        } else {
            // Default: today
            dayStart = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), 0, 0, 0, 0);
            dayEnd = ukNow;
            currentHour = ukNow.getHours();
            isToday = true;
        }

        // Convert UK times to UTC for DB query
        const dayStartUtc = new Date(dayStart.getTime() - ukOffset);
        const dayEndUtc = isToday ? now : new Date(dayEnd.getTime() - ukOffset);

        // --- Fetch creators ---
        const creators = await prisma.creator.findMany({
            where: allowedCreatorIds ? { id: { in: allowedCreatorIds } } : undefined,
            select: { id: true, name: true, avatarUrl: true, hourlyTarget: true, active: true },
            orderBy: { name: "asc" },
        });

        if (creators.length === 0) {
            return NextResponse.json({ currentHour, creators: [], isToday });
        }

        // --- Hourly revenue via Prisma findMany (not $queryRaw) ---
        const creatorIds = creators.map((c) => c.id);

        const transactions = await prisma.transaction.findMany({
            where: {
                date: { gte: dayStartUtc, lt: dayEndUtc },
                creatorId: { in: creatorIds },
            },
            select: { creatorId: true, amount: true, date: true },
        });

        console.log("[hourly] creatorIds:", creatorIds.length, "tx count:", transactions.length,
            "dayStartUtc:", dayStartUtc.toISOString(), "dayEndUtc:", dayEndUtc.toISOString(),
            "ukOffset:", ukOffset, "currentHour:", currentHour);

        // Group by creator + UK hour in JavaScript
        const hoursCount = currentHour + 1;
        const creatorMap = new Map<string, number[]>();

        for (const creator of creators) {
            creatorMap.set(creator.id, new Array(hoursCount).fill(0));
        }

        for (const tx of transactions) {
            if (!tx.creatorId) continue;
            const hourly = creatorMap.get(tx.creatorId);
            if (!hourly) continue;
            const txUk = new Date(tx.date.getTime() + ukOffset);
            const hourIndex = txUk.getHours();
            if (hourIndex >= 0 && hourIndex < hoursCount) {
                hourly[hourIndex] += Number(tx.amount);
            }
        }

        const result = creators.map((c) => {
            const hourly = creatorMap.get(c.id) || new Array(hoursCount).fill(0);
            const total = Math.round(hourly.reduce((s, v) => s + v, 0) * 100) / 100;
            return {
                id: c.id,
                name: c.name || "Unknown",
                avatarUrl: c.avatarUrl || null,
                hourlyTarget: c.hourlyTarget || 100,
                hourly,
                total,
            };
        });

        return NextResponse.json({ currentHour, creators: result, isToday });
    } catch (error: any) {
        console.error("Hourly breakdown error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

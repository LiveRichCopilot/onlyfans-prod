import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
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
                return NextResponse.json({ currentHour: 0, creators: [] });
            }
        }

        // --- UK day window (midnight UK → now) ---
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const todayStart = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), 0, 0, 0, 0);
        const ukOffset = ukNow.getTime() - now.getTime();
        const todayStartUtc = new Date(todayStart.getTime() - ukOffset);
        const currentHour = ukNow.getHours();

        // --- Hourly revenue query ---
        let rows: { creatorId: string; bucket: Date; total: number }[];

        if (allowedCreatorIds) {
            rows = await prisma.$queryRaw`
                SELECT "creatorId",
                       date_trunc('hour', "date") AS bucket,
                       SUM("amount")::float AS total
                FROM "Transaction"
                WHERE "date" >= ${todayStartUtc} AND "date" < ${now}
                  AND "creatorId" IS NOT NULL
                  AND "creatorId" = ANY(${allowedCreatorIds})
                GROUP BY "creatorId", bucket
                ORDER BY bucket
            `;
        } else {
            rows = await prisma.$queryRaw`
                SELECT "creatorId",
                       date_trunc('hour', "date") AS bucket,
                       SUM("amount")::float AS total
                FROM "Transaction"
                WHERE "date" >= ${todayStartUtc} AND "date" < ${now}
                  AND "creatorId" IS NOT NULL
                GROUP BY "creatorId", bucket
                ORDER BY bucket
            `;
        }

        // --- Fetch creators ---
        const creators = await prisma.creator.findMany({
            where: allowedCreatorIds ? { id: { in: allowedCreatorIds } } : undefined,
            select: { id: true, name: true, avatarUrl: true, hourlyTarget: true, active: true },
            orderBy: { name: "asc" },
        });

        // --- Build per-creator hourly arrays ---
        const hoursCount = currentHour + 1;
        const creatorMap = new Map<string, number[]>();

        for (const creator of creators) {
            creatorMap.set(creator.id, new Array(hoursCount).fill(0));
        }

        for (const row of rows) {
            const hourly = creatorMap.get(row.creatorId);
            if (!hourly) continue;
            // Convert bucket to UK hour
            const bucketUk = new Date(row.bucket.getTime() + ukOffset);
            const hourIndex = bucketUk.getHours();
            if (hourIndex >= 0 && hourIndex < hoursCount) {
                hourly[hourIndex] = Math.round(row.total * 100) / 100;
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

        return NextResponse.json({ currentHour, creators: result });
    } catch (error: any) {
        console.error("Hourly breakdown error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

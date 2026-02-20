import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const creators = await prisma.creator.findMany({
            orderBy: { createdAt: "desc" },
        });

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const hourlyTransactions = await prisma.transaction.findMany({
            where: { date: { gte: oneHourAgo } },
            include: { fan: true }
        });

        const hourlyRevMap: Record<string, number> = {};
        hourlyTransactions.forEach((tx: any) => {
            if (tx.fan && tx.fan.creatorId) {
                hourlyRevMap[tx.fan.creatorId] = (hourlyRevMap[tx.fan.creatorId] || 0) + tx.amount;
            }
        });

        const enrichedCreators = creators.map((c: any) => ({
            ...c,
            name: c.ofapiCreatorId || c.telegramId || "Unknown Creator",
            handle: `@${c.ofapiCreatorId || c.telegramId}`,
            hourlyRev: hourlyRevMap[c.id] || 0,
            target: c.hourlyTarget || 100,
            whaleAlertTarget: c.whaleAlertTarget || 200,
        }));

        return NextResponse.json({ creators: enrichedCreators });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

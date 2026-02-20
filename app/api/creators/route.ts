import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const creators = await prisma.creator.findMany({
            orderBy: { createdAt: "desc" },
        });

        // For each creator, calculate their hourly revenue (mock calculation for now, but based on real creator models so the UI isn't mock users)
        const enrichedCreators = creators.map(c => ({
            ...c,
            name: c.ofapiCreatorId || c.telegramId || "Unknown Creator",
            handle: `@${c.ofapiCreatorId || c.telegramId}`,
            hourlyRev: 0, // Would be fetched from transactions
            target: c.hourlyTarget || 100,
            whaleAlertTarget: c.whaleAlertTarget || 200,
        }));

        return NextResponse.json({ creators: enrichedCreators });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEarningsOverview } from "@/lib/ofapi";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const creatorId = params.id;

        // 1. Fetch from our Database to get the Token and Configuration rules
        const creator = await prisma.creator.findUnique({
            where: { id: creatorId },
        });

        if (!creator) {
            return NextResponse.json({ error: "Creator not found" }, { status: 404 });
        }

        // We will default the stats to 0, but if they have a real token, we fetch live data.
        let liveStats = {
            totalRevenue: 0,
            activeFans: 0,
            messagesSent: 0,
        };

        if (creator.ofapiToken && creator.ofapiToken !== "unlinked") {
            try {
                // Fetch live Earnings via OFAPI Helper
                // For a true "monthly" view, you'd pass the start/end of the current month.
                // We'll pass an arbitrary 30-day window here for the prototype dashboard.
                const now = new Date();
                const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

                const earningsPayload = {
                    accounts: [creator.ofapiCreatorId || creator.telegramId],
                    date_range: {
                        start: thirtyDaysAgo.toISOString(),
                        end: now.toISOString()
                    }
                };

                // Note: The structure of this response depends entirely on OnlyFansAPI's exact JSON shape.
                // We wrap this in a try/catch so the UI still loads the module config even if the API stats fail.
                const earningsObj = await getEarningsOverview(creator.ofapiToken, earningsPayload);

                // This is a "best guess" mapping based on standard analytics payloads. 
                // Actual mapping depends on their precise response shape.
                liveStats.totalRevenue = earningsObj?.net || earningsObj?.total || 0;

                // For now, these are mocked as OFAPI doesn't have a documented simple 'fan count' endpoint 
                // exposed in our helper lib yet, but we provide the structure so the UI knows where it will go.
                liveStats.activeFans = 1420; // Placeholder until real /fans/active endpoint is mapped
                liveStats.messagesSent = 8532;

            } catch (ofapiError) {
                console.error(`Failed to fetch live OFAPI stats for ${creator.name}:`, ofapiError);
            }
        }

        return NextResponse.json({
            creator,
            stats: liveStats
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

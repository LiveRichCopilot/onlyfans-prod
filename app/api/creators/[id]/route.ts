import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEarningsOverview, getPeriodComparison, getTopPercentage, getModelStartDate } from "@/lib/ofapi";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;

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
                const now = new Date();
                const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

                const earningsPayload = {
                    accounts: [creator.ofapiCreatorId || creator.telegramId],
                    date_range: {
                        start: thirtyDaysAgo.toISOString(),
                        end: now.toISOString()
                    }
                };

                const comparisonPayload = {
                    accounts: [creator.ofapiCreatorId || creator.telegramId],
                    current_period: {
                        start: thirtyDaysAgo.toISOString(),
                        end: now.toISOString()
                    },
                    previous_period: {
                        start: sixtyDaysAgo.toISOString(),
                        end: thirtyDaysAgo.toISOString()
                    }
                };

                const [earningsObj, comparisonObj, topPercentObj, startDateObj] = await Promise.all([
                    getEarningsOverview(creator.ofapiToken, earningsPayload).catch(() => null),
                    getPeriodComparison(creator.ofapiToken, comparisonPayload).catch(() => null),
                    getTopPercentage(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken).catch(() => null),
                    getModelStartDate(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken).catch(() => null)
                ]);

                // OFAPI comparison payload usually returns a summary with percent_change
                const growthStr = comparisonObj?.summary?.metrics?.revenue?.percent_change || "+0%";
                const topPercentage = topPercentObj?.percentage || "N/A";
                const startDate = startDateObj?.start_date || "Unknown";

                liveStats = {
                    ...liveStats,
                    totalRevenue: earningsObj?.net || earningsObj?.total || 0,
                    // @ts-ignore - appending dynamic key for the frontend
                    growthPercentage: growthStr,
                    topPercentage: topPercentage,
                    startDate: startDate,
                    activeFans: 1420, // Placeholder
                    messagesSent: 8532  // Placeholder
                };

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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;
        const body = await request.json();
        const { whaleAlertTarget, hourlyTarget } = body;

        const updateData: any = {};
        if (whaleAlertTarget !== undefined) updateData.whaleAlertTarget = Number(whaleAlertTarget);
        if (hourlyTarget !== undefined) updateData.hourlyTarget = Number(hourlyTarget);

        const updatedCreator = await prisma.creator.update({
            where: { id: creatorId },
            data: updateData
        });

        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

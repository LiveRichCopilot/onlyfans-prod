import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCreatorProfileStats } from "@/lib/revenue";
import { getMe, getTopPercentage, getStatisticsOverview } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * Creator profile stats.
 * Revenue, top fans, earnings by type, chart = from Supabase (instant, accurate).
 * Subscriber count, OF ranking, mass messages, visitors = from OFAPI (non-transaction data).
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

        // All revenue stats from local Supabase — instant, LA time
        const revenueStats = await getCreatorProfileStats(creatorId);

        // Non-transaction data from OFAPI (3 calls instead of 13)
        let subscribersCount = 0;
        let topPercentage: string | number = "N/A";
        let massMessages = { count: 0, earnings: 0 };
        let newSubs = 0;
        let visitors = 0;

        if (creator.ofapiToken && creator.ofapiToken !== "unlinked") {
            const acct = creator.ofapiCreatorId || creator.telegramId;
            const key = creator.ofapiToken;
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const fmt = (d: Date) => d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

            const [meRes, topPctRes, overviewRes] = await Promise.all([
                getMe(acct, key).catch(() => null),
                getTopPercentage(acct, key).catch(() => null),
                getStatisticsOverview(acct, key, fmt(sevenDaysAgo), fmt(now)).catch(() => null),
            ]);

            // Subscriber count from /me
            const me = meRes?.data || meRes || {};
            subscribersCount = me.subscribersCount || 0;

            // OF ranking
            topPercentage = topPctRes?.data?.top_percentage ?? topPctRes?.percentage ?? "N/A";

            // Overview — mass messages, visitors, new subs
            const ov = overviewRes?.data || {};
            if (ov.massMessages) {
                massMessages = {
                    count: ov.massMessages.count?.total || 0,
                    earnings: ov.massMessages.earnings?.gross || 0,
                };
            }
            newSubs = ov.visitors?.subscriptions?.new?.total || 0;
            visitors = ov.visitors?.visitors?.total || 0;
        }

        const stats = {
            ...revenueStats,
            topFans: revenueStats.topFansToday, // Alias for StatsGrid component
            subscribersCount,
            topPercentage,
            massMessages,
            newSubs,
            visitors,
        };

        return NextResponse.json({ creator, stats });
    } catch (error: any) {
        console.error("Creator profile API error:", error);
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
        const updatedCreator = await prisma.creator.update({ where: { id: creatorId }, data: updateData });
        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

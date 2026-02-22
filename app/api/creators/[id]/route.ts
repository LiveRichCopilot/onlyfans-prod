import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    getTransactionsSummary,
    getTransactions,
    getActiveFans,
    getTopPercentage,
    getModelStartDate,
    getNotificationCounts,
    calculateTopFans,
} from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const creatorId = (await params).id;

        const creator = await prisma.creator.findUnique({
            where: { id: creatorId },
        });

        if (!creator) {
            return NextResponse.json({ error: "Creator not found" }, { status: 404 });
        }

        // Default stats — all zeros, no fakes
        const stats: any = {
            todayRevenue: 0,
            monthlyRevenue: 0,
            weeklyRevenue: 0,
            hourlyRevenue: 0,
            activeFans: 0,
            topPercentage: "N/A",
            startDate: "Unknown",
            topFans: [],
            txCountToday: 0,
        };

        if (creator.ofapiToken && creator.ofapiToken !== "unlinked") {
            const accountName = creator.ofapiCreatorId || creator.telegramId;
            const apiKey = creator.ofapiToken;
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            try {
                // Fetch everything in parallel — same proven approach as Telegram cron
                const [summary1h, summaryToday, summary7d, summary30d, fansRes, topPercentObj, startDateObj, txRes] = await Promise.all([
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: oneHourAgo.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: todayStart.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: sevenDaysAgo.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getTransactionsSummary(apiKey, { account_ids: [accountName], start_date: thirtyDaysAgo.toISOString(), end_date: now.toISOString() }, accountName).catch(() => null),
                    getActiveFans(accountName, apiKey).catch(() => null),
                    getTopPercentage(accountName, apiKey).catch(() => null),
                    getModelStartDate(accountName, apiKey).catch(() => null),
                    getTransactions(accountName, apiKey).catch(() => null),
                ]);

                // Revenue — parse the same way Telegram does
                stats.hourlyRevenue = parseFloat(summary1h?.data?.total_gross || summary1h?.total_gross || "0");
                stats.todayRevenue = parseFloat(summaryToday?.data?.total_gross || summaryToday?.total_gross || "0");
                stats.weeklyRevenue = parseFloat(summary7d?.data?.total_gross || summary7d?.total_gross || "0");
                stats.monthlyRevenue = parseFloat(summary30d?.data?.total_gross || summary30d?.total_gross || "0");

                // Active fans — handle array or count object
                const fansData = fansRes?.data || fansRes;
                stats.activeFans = Array.isArray(fansData)
                    ? fansData.length
                    : typeof fansData?.count === "number"
                      ? fansData.count
                      : typeof fansData?.total === "number"
                        ? fansData.total
                        : 0;

                // Top percentage & start date
                stats.topPercentage = topPercentObj?.percentage || topPercentObj?.data?.percentage || "N/A";
                stats.startDate = startDateObj?.start_date || startDateObj?.data?.start_date || "Unknown";

                // Top fans from raw transactions (today)
                const allTx = txRes?.data?.list || txRes?.list || txRes?.transactions || [];
                const todayTx = allTx.filter((t: any) => new Date(t.createdAt) >= todayStart);
                stats.topFans = calculateTopFans(todayTx, 0).slice(0, 5);
                stats.txCountToday = todayTx.length;

            } catch (ofapiError: any) {
                console.error(`Failed to fetch OFAPI stats for ${creator.name}: ${ofapiError.message}`);
            }
        }

        return NextResponse.json({ creator, stats });
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
            data: updateData,
        });

        return NextResponse.json({ success: true, creator: updatedCreator });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

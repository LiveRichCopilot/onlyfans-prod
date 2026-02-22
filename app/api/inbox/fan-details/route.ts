import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

/**
 * Get fan details for the sidebar: total spend, last paid, subscription info.
 * Pulls from OFAPI transactions filtered by this fan.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");
    const fanId = searchParams.get("fanId");

    if (!creatorId || !fanId) {
        return NextResponse.json({ error: "Missing creatorId or fanId" }, { status: 400 });
    }

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    try {
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not linked" }, { status: 404 });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;

        // Fetch recent transactions and filter for this fan
        const txRes = await getTransactions(accountName, apiKey).catch(() => null);
        const allTx = txRes?.data?.list || txRes?.list || txRes?.transactions || [];

        const fanTx = allTx.filter((t: any) => {
            const uid = t.user?.id?.toString() || t.fan?.id?.toString();
            return uid === fanId;
        });

        // Calculate stats from this fan's transactions
        const totalSpend = fanTx.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
        const sortedByDate = [...fanTx].sort((a: any, b: any) =>
            new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        );
        const lastPaid = sortedByDate.length > 0
            ? new Date(sortedByDate[0].createdAt || sortedByDate[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null;
        const firstTx = sortedByDate.length > 0
            ? new Date(sortedByDate[sortedByDate.length - 1].createdAt || sortedByDate[sortedByDate.length - 1].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : null;

        // Build purchase history
        const purchases = fanTx.map((t: any) => ({
            id: t.id?.toString() || t.transaction_id?.toString(),
            amount: parseFloat(t.amount) || 0,
            type: t.type || t.transactionType || "unknown",
            date: t.createdAt || t.date,
            description: t.description || t.text || null,
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({
            fanId,
            totalSpend: Math.round(totalSpend * 100) / 100,
            lastPaid,
            fanSince: firstTx,
            txCount: fanTx.length,
            purchases,
        });
    } catch (e: any) {
        console.error("Fan details error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

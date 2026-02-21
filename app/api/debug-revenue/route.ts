import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionsSummary, getEarningsOverview, getTransactionsByType, getTransactions } from "@/lib/ofapi";

export async function GET(request: NextRequest) {
    try {
        const creator = await prisma.creator.findFirst({
            where: { name: { contains: "Lauren" } }
        });

        if (!creator) return NextResponse.json({ error: "No creator found" });

        const now = new Date();
        // The dashboard screenshot shows From: Feb 19, 2026 To: Feb 28, 2026 
        // We simulate the exact same payload params 
        const startWindow = new Date("2026-02-19T00:00:00Z");

        const payload = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: startWindow.toISOString(),
            end_date: now.toISOString()
        };

        const [summary, earnings, byType, rawTxs] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken || "", payload).catch(e => ({ error: e.message })),
            getEarningsOverview(creator.ofapiToken || "", payload).catch(e => ({ error: e.message })),
            getTransactionsByType(creator.ofapiToken || "", payload).catch(e => ({ error: e.message })),
            getTransactions(creator.ofapiCreatorId || creator.telegramId || "", creator.ofapiToken || "", undefined, 2000).catch(e => ({ error: e.message }))
        ]);

        const list = rawTxs?.list || rawTxs?.data?.list || [];
        const recentTxs = list.filter((t: any) => new Date(t.createdAt) >= startWindow);
        let manualSum = 0;
        recentTxs.forEach((t: any) => manualSum += parseFloat(t.amount || t.gross || t.price || "0"));

        return NextResponse.json({
            dashboard_match_params: payload,
            getTransactionsSummary: summary,
            getEarningsOverview: earnings,
            getTransactionsByType: byType,
            getTransactions_ManualSum: manualSum.toFixed(2),
            raw_tx_count_since_feb19: recentTxs.length,
            sample_recent_tx: recentTxs[0] || null
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

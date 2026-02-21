import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactions, getTransactionsSummary } from "@/lib/ofapi";

export async function GET(request: NextRequest) {
    try {
        const creator = await prisma.creator.findFirst({
            where: { name: { contains: "Lauren" } }
        });

        if (!creator) return NextResponse.json({ error: "No creator found" });

        const now = new Date();
        const start24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const payload24h = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: start24h.toISOString(),
            end_date: now.toISOString()
        };

        const [summary, transactions] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken, payload24h).catch(e => ({ error: e.message })),
            getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken).catch(e => ({ error: e.message }))
        ]);

        return NextResponse.json({
            creator: creator.name,
            summary_api: summary,
            transactions_count: transactions?.list?.length || transactions?.data?.list?.length || 0,
            first_transaction: transactions?.list?.[0] || transactions?.data?.list?.[0] || null
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

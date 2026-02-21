import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getTransactionsSummary, getEarningsOverview, getTransactionsByType, getTransactions } from './lib/ofapi';

const app = express();
const prisma = new PrismaClient();

app.get('/debug', async (req, res) => {
    try {
        const creator = await prisma.creator.findFirst({
            where: { name: { contains: "Lauren" } }
        });

        if (!creator) return res.status(404).json({ error: "No creator found" });

        const now = new Date();
        const startWindow = new Date("2026-02-19T00:00:00Z");

        const payload = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: startWindow.toISOString(),
            end_date: now.toISOString()
        };

        const [summary, earnings, byType, rawTxs] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken, payload).catch(e => ({ error: e.message })),
            getEarningsOverview(creator.ofapiToken, payload).catch(e => ({ error: e.message })),
            getTransactionsByType(creator.ofapiToken, payload).catch(e => ({ error: e.message })),
            getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken, undefined, 2000).catch(e => ({ error: e.message }))
        ]);

        const list = rawTxs?.list || rawTxs?.data?.list || [];
        const recentTxs = list.filter((t:any) => new Date(t.createdAt) >= startWindow);
        let manualSum = 0;
        recentTxs.forEach((t:any) => manualSum += parseFloat(t.amount || t.gross || t.price || "0"));

        res.json({
            dashboard_match_params: payload,
            getTransactionsSummary: summary,
            getEarningsOverview: earnings,
            getTransactionsByType: byType,
            getTransactions_ManualSum: manualSum.toFixed(2),
            raw_tx_count_since_feb19: recentTxs.length,
            sample_recent_tx: recentTxs[0] || null
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(9876, () => console.log('Debug bridge listening on 9876'));

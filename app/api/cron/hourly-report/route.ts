import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bot } from '@/lib/telegram';
import { InlineKeyboard } from 'grammy';

/**
 * Hourly Report Cron — Automated Brief
 *
 * IMPORTANT: Uses local DB (Transaction table) as source of truth.
 * NOT OFAPI analytics — getTransactionsSummary does NOT support sub-daily granularity
 * and returns full-day totals regardless of time window passed.
 * The sync-transactions cron syncs OFAPI → DB every 5 minutes.
 */
export async function GET(req: Request) {
    if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === 'production') {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    }

    try {
        const creators = await prisma.creator.findMany({
            where: { ofapiToken: { not: null }, active: true }
        });

        if (creators.length === 0) {
            return NextResponse.json({ status: 'no_creators' });
        }

        for (const creator of creators) {
            if (!creator.ofapiToken) continue;

            const targetChat = creator.telegramGroupId || creator.telegramId;
            if (!targetChat) continue;

            const name = creator.name || 'Creator';

            const now = new Date();
            const start1h = new Date(now.getTime() - (1 * 60 * 60 * 1000));
            const start24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

            // Query LOCAL DB for accurate revenue — not OFAPI analytics
            const [revenue1h, revenue24h, topFansData] = await Promise.all([
                prisma.transaction.aggregate({
                    where: { creatorId: creator.id, date: { gte: start1h } },
                    _sum: { amount: true },
                    _count: true,
                }),
                prisma.transaction.aggregate({
                    where: { creatorId: creator.id, date: { gte: start24h } },
                    _sum: { amount: true },
                    _count: true,
                }),
                prisma.transaction.groupBy({
                    by: ['fanId'],
                    where: { creatorId: creator.id, date: { gte: start24h } },
                    _sum: { amount: true },
                    orderBy: { _sum: { amount: 'desc' } },
                    take: 5,
                }),
            ]);

            const gross1h = (revenue1h._sum.amount || 0).toFixed(2);
            const gross24h = (revenue24h._sum.amount || 0).toFixed(2);

            // Resolve fan names for top spenders
            const topFanIds = topFansData
                .filter((f) => (f._sum.amount || 0) > 0)
                .map((f) => f.fanId);

            const fans = topFanIds.length > 0
                ? await prisma.fan.findMany({
                    where: { id: { in: topFanIds } },
                    select: { id: true, name: true, username: true },
                })
                : [];

            const fanMap = new Map(fans.map((f) => [f.id, f]));

            let md = `AUTOMATED BRIEF: ${name}\n\n`;
            md += `Last Hour: $${gross1h} (${revenue1h._count} tx)\n`;
            md += `Last 24 Hours: $${gross24h} (${revenue24h._count} tx)\n\n`;
            md += `Top 3 Spenders [Last 24h]\n`;

            let topSpenderId: string | null = null;
            let topSpenderName = "";

            const topEntries = topFansData.filter((f) => (f._sum.amount || 0) > 0).slice(0, 3);

            if (topEntries.length === 0) {
                md += "No spenders found.\n";
            } else {
                topEntries.forEach((entry, i) => {
                    const fan = fanMap.get(entry.fanId);
                    const displayName = fan?.name || fan?.username || "Anonymous";
                    const username = fan?.username || "?";
                    const amount = (entry._sum.amount || 0).toFixed(2);
                    md += `${i + 1}. ${displayName} (@${username}) — $${amount}\n`;

                    if (i === 0) {
                        topSpenderId = username;
                        topSpenderName = displayName;
                    }
                });
            }

            const replyOpt = creator.telegramGroupId ? { message_thread_id: 5 } : {};

            if (topSpenderId && topEntries[0]._sum.amount && topEntries[0]._sum.amount > 0) {
                md += `\nAction Required: Your #1 whale is ${topSpenderName}. Want to send them content or a voice note?`;

                const keyboard = new InlineKeyboard()
                    .text("Voice Note", `alert_reply_voice_${topSpenderId}`).row()
                    .text("Send Video", `alert_reply_video_${topSpenderId}`).row()
                    .text("Skip / Dismiss", "action_skip");

                await bot.api.sendMessage(targetChat, md, Object.assign({}, replyOpt, { reply_markup: keyboard })).catch(console.error);
            } else {
                await bot.api.sendMessage(targetChat, md, replyOpt).catch(console.error);
            }
        }

        return NextResponse.json({ status: 'ok', dispatched: creators.length });
    } catch (err: any) {
        console.error("Cron Error", err);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

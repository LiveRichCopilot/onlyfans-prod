import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bot } from '@/lib/telegram';
import { getTransactionsSummary, getTransactions, calculateTopFans } from '@/lib/ofapi';
import { InlineKeyboard } from 'grammy';

// Vercel Cron Endpoint handler for the fully-automated Daily Brief 
export async function GET(req: Request) {
    if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        // Enforce cron security so random people don't trigger the broadcast. 
        // Vercel Cron injects this secret automatically.
        if (process.env.NODE_ENV === 'production') {
            return new NextResponse('Unauthorized', { status: 401 });
        }
    }

    try {
        const creators = await prisma.creator.findMany({
            where: { ofapiToken: { not: null } }
        });

        if (creators.length === 0) {
            return NextResponse.json({ status: 'no_creators' });
        }

        for (const creator of creators) {
            if (!creator.ofapiToken) continue;

            const accountName = creator.ofapiCreatorId || creator.telegramId || 'default';
            const apiKey = creator.ofapiToken;
            const targetChat = creator.telegramGroupId || creator.telegramId;

            if (!targetChat) continue;

            const name = creator.name || accountName;

            const now = new Date();
            const start1h = new Date(now.getTime() - (1 * 60 * 60 * 1000));
            const start24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

            const payload1h = {
                account_ids: [accountName],
                start_date: start1h.toISOString(),
                end_date: now.toISOString()
            };
            const payload24h = {
                account_ids: [accountName],
                start_date: start24h.toISOString(),
                end_date: now.toISOString()
            };

            const [summary1h, summary24h, txResponse] = await Promise.all([
                getTransactionsSummary(apiKey, payload1h).catch(() => null),
                getTransactionsSummary(apiKey, payload24h).catch(() => null),
                getTransactions(accountName, apiKey).catch(() => null)
            ]);

            const gross1h = parseFloat(summary1h?.data?.total_gross || "0").toFixed(2);
            const gross24h = parseFloat(summary24h?.data?.total_gross || "0").toFixed(2);

            const allTx = txResponse?.data?.list || txResponse?.list || txResponse?.transactions || [];
            const rawTxs = allTx.filter((t: any) => new Date(t.createdAt) >= start24h);
            const topFans = calculateTopFans(rawTxs, 0);

            let md = `🤖 **AUTOMATED BRIEF**: ${name}\n\n`;
            md += `⏱ **Last Hour Sells:** $${gross1h}\n`;
            md += `📅 **Last 24 Hours:** $${gross24h}\n\n`;
            md += `🏆 **Top 3 Spenders [Last 24h]**\n`;

            let topSpenderId = null;
            let topSpenderName = "";

            if (topFans.length === 0) {
                md += "No spenders found.\n";
            } else {
                topSpenderId = topFans[0].username;
                topSpenderName = topFans[0].name;
                const displayList = topFans.slice(0, 3);
                displayList.forEach((fan: any, i: number) => {
                    md += `${i + 1}. ${fan.name} (@${fan.username}) — $${fan.spend.toFixed(2)}\n`;
                });
            }

            const replyOpt = creator.telegramGroupId ? { message_thread_id: 5 } : {};

            if (topSpenderId && topFans[0].spend > 0) {
                md += `\n🎯 **Action Required:** Your #1 whale is ${topSpenderName}. Want to send them content or a voice note?`;

                const keyboard = new InlineKeyboard()
                    .text("🎤 Voice Note", `alert_reply_voice_${topSpenderId}`).row()
                    .text("📹 Send Video", `alert_reply_video_${topSpenderId}`).row()
                    .text("Skip / Dismiss", "action_skip");

                await bot.api.sendMessage(targetChat, md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const, reply_markup: keyboard })).catch(console.error);
            } else {
                await bot.api.sendMessage(targetChat, md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const })).catch(console.error);
            }
        }

        return NextResponse.json({ status: 'ok', dispatched: creators.length });
    } catch (err: any) {
        console.error("Cron Error", err);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

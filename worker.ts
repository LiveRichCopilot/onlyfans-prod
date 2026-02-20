import "dotenv/config";
import { bot } from "./lib/telegram";
import { prisma } from "./lib/prisma";
import { getTransactionsSummary, getEarningsOverview, getTransactions, calculateTopFans } from "./lib/ofapi";
import { InlineKeyboard } from "grammy";

// Constants
const WHALE_THRESHOLD = 100;

async function processCreators() {
    console.log("Starting worker cycle (Real API context)...");

    const creators = await prisma.creator.findMany({
        where: { ofapiToken: { not: null } }
    });

    if (creators.length === 0) {
        console.log("No active creators found with API tokens. Waiting for onboarding...");
        return;
    }

    for (const creator of creators) {
        if (!creator.ofapiToken) continue;
        const handle = creator.ofapiCreatorId || 'default';
        await processChatterPerformance(handle, creator.ofapiToken, creator.telegramId, creator.telegramGroupId, 100);
        await processWhaleAlerts(handle, creator.ofapiToken, creator.telegramId);
    }
}

async function processWhaleAlerts(accountName: string, apiKey: string, telegramId: string | null) {
    if (!telegramId) return;

    try {
        // Fetch recent transactions (Ex: type=tip) for the CURRENT day (cumulative)
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // This simulates requesting all transactions from today to calculate cumulative spend per fan
        const response = await getTransactions(accountName, apiKey, `?type=tip&start_date=${startOfDay.toISOString()}`);
        const transactions = response?.data || [];

        // Aggregate totals by Fan ID for today
        const fanTotals: Record<string, number> = {};
        for (const tx of transactions) {
            fanTotals[tx.fan_id] = (fanTotals[tx.fan_id] || 0) + tx.amount;
        }

        // Fetch user's custom whale threshold from our database
        // Defaulting to 1000 if not set yet via new Prisma schema
        const creatorData = await prisma.creator.findUnique({
            where: { ofapiCreatorId: accountName }
        });
        const whaleLimit = creatorData?.whaleAlertTarget || 1000;

        for (const [fanId, totalSpend] of Object.entries(fanTotals)) {
            if (totalSpend >= whaleLimit) {
                // To avoid spamming, we should check a 'LastAlerted' date in the DB.
                // For V3 mock logic, we'll log it and send the Interactive Alert immediately.
                console.log(`[CUMULATIVE WHALE ALERT] ${accountName}: Fan ${fanId} hit $${totalSpend} today! (Limit: $${whaleLimit})`);

                // Fallback username for mock display
                const fanName = creatorData?.name ? `Marcus T.` : `Fan_${fanId.substring(0, 4)}`;

                const keyboard = new InlineKeyboard()
                    .text("🎤 Voice Note", `alert_reply_voice_${fanId}`)
                    .text("📹 Video", `alert_reply_video_${fanId}`)
                    .text("✍️ Text", `alert_reply_text_${fanId}`)
                    .text("Skip", "action_skip");

                const message = `
🐳 Whale Alert

Fan: ${fanName}
Spent today: $${totalSpend}
Lifetime: $4,200
On page: 8 months

He tipped $200 on your last PPV.

How do you want to respond?`;

                await bot.api.sendMessage(telegramId, message, { reply_markup: keyboard });
            }
        }
    } catch (e: any) {
        console.error(`Whale processing error for ${accountName}: ${e.message}`);
    }
}

/**
 * Background Broadcast (Auto-Reporting)
 * Broadcasts 1h/24h sales and Top Spenders automatically to the Telegram Group.
 */
async function processChatterPerformance(accountName: string, apiKey: string, telegramId: string | null, telegramGroupId: string | null, targetPerHour: number) {
    try {
        const targetChat = telegramGroupId || telegramId;
        if (!targetChat) return;

        const creator = await prisma.creator.findUnique({
            where: { ofapiCreatorId: accountName }
        });
        const name = creator?.name || accountName;

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
            displayList.forEach((fan, i) => {
                md += `${i + 1}. ${fan.name} (@${fan.username}) — $${fan.spend.toFixed(2)}\n`;
            });
        }

        const replyOpt = telegramGroupId ? { message_thread_id: 5 } : {}; // Thread ID 5 for General topic default

        if (topSpenderId && topFans[0].spend > 0) {
            md += `\n🎯 **Action Required:** Your #1 whale is ${topSpenderName}. Want to send them content or a voice note?`;

            const keyboard = new InlineKeyboard()
                .text("🎤 Voice Note", `alert_reply_voice_${topSpenderId}`).row()
                .text("📹 Send Video", `alert_reply_video_${topSpenderId}`).row()
                .text("Skip / Dismiss", "action_skip");

            await bot.api.sendMessage(targetChat, md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const, reply_markup: keyboard }));
        } else {
            await bot.api.sendMessage(targetChat, md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));
        }

    } catch (err: any) {
        console.error(`Error broadcasting brief for ${accountName}:`, err?.message || err);
    }
}

async function sendChatterWarningAlert(telegramId: string, data: any) {
    const keyboard = new InlineKeyboard()
        .text("Message Manager", "action_msg_manager")
        .text("Acknowledge", "action_ack");

    const message = `
⚠️ CHATTER TARGET MISSED ⚠️

Account: "@${data.accountName}"
Revenue (Last Hour): $${data.hourlyRevenue}
Target: $${data.targetPerHour}

Chatters are currently falling behind the hourly revenue goal. Check the feed and course correct.`;

    try {
        await bot.api.sendMessage(telegramId, message, { reply_markup: keyboard });
        console.log("Chatter Warning alert sent.");
    } catch (e) {
        console.error("Telegram send failed (might be invalid chat id): " + e);
    }
}

// Start processing loop
// Run every 10 minutes to avoid blowing out API credits on the summary endpoint.
setInterval(processCreators, 10 * 60 * 1000);
processCreators(); 

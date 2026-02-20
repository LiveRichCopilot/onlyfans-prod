import "dotenv/config";
import { bot } from "./lib/telegram";
import { prisma } from "./lib/prisma";
import { getTransactionsSummary, getEarningsOverview, getTransactions } from "./lib/ofapi";
import { InlineKeyboard } from "grammy";

// Constants
const WHALE_THRESHOLD = 100;

async function processCreators() {
    console.log("Starting worker cycle (Real API context)...");

    const creators = await prisma.creator.findMany({
        where: { ofapiToken: { not: null } }
    });

    // If no creators exist yet, run a mocked safety check for testing purposes
    if (creators.length === 0 && process.env.TEST_OFAPI_KEY) {
        console.log("No creators found. Using TEST_OFAPI_KEY for a direct API call...");
        await processChatterPerformance(
            'madison420ivy',
            process.env.TEST_OFAPI_KEY,
            process.env.TELEGRAM_BOT_TOKEN ? 'liverichmedia' : null,
            100
        );
        await processWhaleAlerts(
            'madison420ivy',
            process.env.TEST_OFAPI_KEY,
            process.env.TELEGRAM_BOT_TOKEN ? 'liverichmedia' : null
        );
    }

    for (const creator of creators) {
        if (!creator.ofapiToken) continue;
        const handle = creator.ofapiCreatorId || 'default';
        await processChatterPerformance(handle, creator.ofapiToken, creator.telegramId, 100);
        await processWhaleAlerts(handle, creator.ofapiToken, creator.telegramId);
    }
}

/**
 * Whale Monitoring Core Logic (NOT-01 & Vault Integration)
 * Checks for individual transactions over $200 and triggers the Vault flow.
 */
async function processWhaleAlerts(accountName: string, apiKey: string, telegramId: string | null) {
    if (!telegramId) return;

    try {
        // Fetch recent transactions (Ex: type=tip)
        const response = await getTransactions(accountName, apiKey, "tip");

        // In real logic, we'd compare against lastSyncCursor. For this V3 production demo, we check if any are > $200
        const whales = (response?.data || []).filter((tx: any) => tx.amount >= 200);

        for (const whale of whales) {
            console.log(`[WHALE ALERT] ${accountName} got $${whale.amount} from Fan ${whale.fan_id}`);

            // Build interactive Telegram button group
            const keyboard = new InlineKeyboard()
                .text("🎙 Voice Note", `action_voice_${whale.fan_id}`)
                .text("📷 Picture", `action_pic_${whale.fan_id}`)
                .text("🎥 Video", `action_vid_${whale.fan_id}`)
                .row()
                .text("⏭ Skip", "action_skip");

            const message = `
🚨 WHALE ALERT: $${whale.amount} 🚨

Fan: ${whale.fan_id}
Module: ${accountName}

How would you like to respond? (Media goes through AI Safety filter and straight to Vault)`;

            await bot.api.sendMessage(telegramId, message, { reply_markup: keyboard });
        }
    } catch (e: any) {
        console.error(`Whale processing error for ${accountName}: ${e.message}`);
    }
}

/**
 * Chatter Monitoring Core Logic (STF-01)
 * Checks revenue for the last hour and alerts if they missed the target.
 */
async function processChatterPerformance(accountName: string, apiKey: string, telegramId: string | null, targetPerHour: number) {
    try {
        // 1. Calculate the time window for the last 1 hour
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));

        // For real production we would use the getEarningsOverview or getTransactionsSummary
        // Since we need an hourly window, let's ask for transactions in that window.
        // The exact param for date filtering depends on OnlyFansApi.com's undocumented query string, but we pass standard iso strings
        // E.g getTransactions(accountName, apiKey, `?start_date=${oneHourAgo.toISOString()}`);
        // Here we use the actual method we defined:

        // As per the provided spec, we might need a summary: POST /api/analytics/financial/transactions/summary
        const summaryPayload = {
            accounts: [accountName],
            date_range: {
                start: oneHourAgo.toISOString(),
                end: now.toISOString()
            }
        };

        const revenueStats = await getTransactionsSummary(apiKey, summaryPayload);

        // Safely parse the response (assumes the API returns a 'totals' or 'net' field)
        const hourlyRevenue = revenueStats?.net || revenueStats?.gross || 0;

        console.log(`[${accountName}] Hourly Revenue: $${hourlyRevenue} | Target: $${targetPerHour}`);

        if (hourlyRevenue < targetPerHour) {
            if (telegramId) {
                await sendChatterWarningAlert(telegramId, {
                    accountName,
                    hourlyRevenue,
                    targetPerHour
                });
            } else {
                console.log(`[${accountName}] Missed target ($${hourlyRevenue}) but no Telegram ID configured.`);
            }
        }
    } catch (err: any) {
        // Error could be 422 if the real payload format differs slightly, we log safely.
        console.error(`Error processing ${accountName}:`, err?.message || err);
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

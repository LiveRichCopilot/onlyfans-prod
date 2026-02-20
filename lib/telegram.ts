import { Bot, InlineKeyboard } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

export const bot = new Bot(token, {
    botInfo: {
        id: 8554732867,
        is_bot: true,
        first_name: "OnlyFans Essentials",
        username: "OFessentialsbot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: true,
        allows_users_to_create_topics: false
    }
});

import { prisma } from "./prisma";
import {
    uploadToVault,
    getTransactionsSummary,
    getTransactionsByType,
    getRevenueForecast,
    getNotificationCounts,
    getTransactions,
    calculateTopFans
} from "./ofapi";
import { analyzeMediaSafety } from "./ai-analyzer";

bot.catch((err) => {
    console.error("Global Grammy Error:", err);
});

bot.command("testbot", async (ctx) => {
    await ctx.reply("System Status: Bot is awake but database is bypassed.");
});

bot.command("start", async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);

        // Find if this user already exists
        let creator = await prisma.creator.findFirst({
            where: { telegramId }
        });

        if (creator) {
            // If they are starting the bot in a group chat, save the group ID
            if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
                creator = await prisma.creator.update({
                    where: { id: creator.id },
                    data: { telegramGroupId }
                });
            }
            await ctx.reply(`Welcome back ${creator.name}! Your account is connected to OnlyFans Essentials. Waiting for live alerts in this chat...`);
        } else {
            await ctx.reply("Welcome to OnlyFans Essentials. You are not linked to a Creator profile yet. Please log into the web dashboard first.");
        }
    } catch (e) {
        console.error("Start Error:", e);
        await ctx.reply("System error during initialization.");
    }
});

bot.command("ping", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });
        await ctx.reply(`Pong! 🏓\nGroup ID: ${telegramGroupId}\nThread ID: ${threadId || 'None'}\nUser ID: ${telegramId}\nCreator Found: ${creator ? creator.name : 'NO'}`, replyOpt);
    } catch (e) {
        console.error(e);
        await ctx.reply("Ping failed internally.", replyOpt);
    }
});

// V7 Reporting Commands
bot.command("stats", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        // Ex: /stats 24h or /stats 7d
        const args = ctx.match || "24h";
        let hours = parseInt(args);
        if (isNaN(hours)) hours = 24;
        if (args.includes('d')) hours = parseInt(args) * 24;

        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("❌ You are not linked to an OnlyFans account.", replyOpt);
        }

        await ctx.reply(`📊 Fetching performance data for the last ${args}...`, replyOpt);

        const now = new Date();
        const startWindow = new Date(now.getTime() - (hours * 60 * 60 * 1000));

        const payload = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: startWindow.toISOString(),
            end_date: now.toISOString()
        };

        const [summary, byType] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken, payload).catch(() => null),
            getTransactionsByType(creator.ofapiToken, payload).catch(() => null)
        ]);

        if (!summary) return ctx.reply("❌ API Error: Could not fetch transaction summary at this time.");

        const summaryData = summary?.data || {};

        const md = `
PERFORMANCE REPORT: ${creator.name}
Window: Last ${args}

Gross Revenue: $${parseFloat(summaryData.total_gross || "0").toFixed(2)}
Net Profit: $${parseFloat(summaryData.total_net || "0").toFixed(2)}
Platform Fees: $${parseFloat(summaryData.total_fees || "0").toFixed(2)}

Breakdown:
- Subscriptions: $${(byType?.subscriptions || 0).toFixed(2)}
- Tips: $${(byType?.tips || 0).toFixed(2)}
- Messages: $${(byType?.messages || 0).toFixed(2)}
        `;

        await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));

    } catch (e: any) {
        console.error("Stats command error", e);
        await ctx.reply("⚠️ Failed to generate report.", replyOpt);
    }
});

bot.command("report", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("❌ You are not linked.", replyOpt);
        }

        await ctx.reply(`📊 Compiling Live Daily Brief for ${creator.name}...`, replyOpt);

        const now = new Date();
        const start1h = new Date(now.getTime() - (1 * 60 * 60 * 1000));
        const start24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const payload1h = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: start1h.toISOString(),
            end_date: now.toISOString()
        };
        const payload24h = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: start24h.toISOString(),
            end_date: now.toISOString()
        };

        const [summary1h, summary24h, txResponse] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken, payload1h).catch(() => null),
            getTransactionsSummary(creator.ofapiToken, payload24h).catch(() => null),
            getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken).catch(() => null)
        ]);

        const gross1h = parseFloat(summary1h?.data?.total_gross || "0").toFixed(2);
        const gross24h = parseFloat(summary24h?.data?.total_gross || "0").toFixed(2);

        const allTx = txResponse?.data?.list || txResponse?.list || txResponse?.transactions || [];
        const rawTxs = allTx.filter((t: any) => new Date(t.createdAt) >= start24h);
        const topFans = calculateTopFans(rawTxs, 0);

        let md = `🔥 **DAILY BRIEF**: ${creator.name}\n\n`;
        md += `⏱ **1-Hour Velocity:** $${gross1h}\n`;
        md += `📅 **24-Hour Total:** $${gross24h}\n\n`;
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

        if (topSpenderId && topFans[0].spend > 0) {
            md += `\n🎯 **Action Required:** Your #1 whale right now is ${topSpenderName}. Would you like to send them a private reward or voice note to their inbox?`;

            const keyboard = new InlineKeyboard()
                .text("🎤 Voice Note", `alert_reply_voice_${topSpenderId}`).row()
                .text("📹 Send Video", `alert_reply_video_${topSpenderId}`).row()
                .text("Skip / Dismiss", "action_skip");

            await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const, reply_markup: keyboard }));
        } else {
            await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));
        }

    } catch (e: any) {
        console.error("Report command error", e);
        await ctx.reply("⚠️ Failed to generate comprehensive report.", replyOpt);
    }
});

bot.command("forecast", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") return;

        await ctx.reply(`📈 Booting statistical modeling engine for ${creator.name}...`, replyOpt);

        // We look at the last 30 days to project the next 7
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const payload = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            model: "ARIMA",
            start_date: thirtyDaysAgo.toISOString(),
            end_date: now.toISOString()
        };

        const forecast = await getRevenueForecast(creator.ofapiToken, payload);

        const md = `
7-DAY REVENUE FORECAST:
Model: ARIMA

Forecasted Net: $${(forecast.projected_net || 0).toFixed(2)}
Confidence Interval: +/- $${(forecast.interval_variance || 0).toFixed(2)}

Note: This projection is based purely on the velocity of your last 30 days of standard transactions.
        `;

        await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));

    } catch (e: any) {
        console.error("Forecast command error", e);
        await ctx.reply("⚠️ Failed to generate forecast.", replyOpt);
    }
});

bot.command("notifications", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("❌ You are not linked.", replyOpt);
        }

        const counts = await getNotificationCounts(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);

        const md = `
UNREAD ALERTS: ${creator.name}

Messages: ${counts.messages || 0}
Tips: ${counts.tips || 0}
New Fans: ${counts.subscribers || 0}
         `;

        await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));
    } catch (e: any) {
        console.error("Notifications command error", e);
        await ctx.reply("⚠️ Failed to fetch notification counts.", replyOpt);
    }
});

bot.command("topfans", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const textStr = ctx.match || "";
        const parts = textStr.split(" ").filter(Boolean);

        let days = 1; // default 1 day
        let threshold = 1000; // default minimum $1000

        if (parts.length > 0) {
            days = parseInt(parts[0].replace('d', '')) || 1;
        }
        if (parts.length > 1) {
            threshold = parseFloat(parts[1]) || 1000;
        }

        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("❌ You are not linked to an OnlyFans account.", replyOpt);
        }

        await ctx.reply(`🔍 Analyzing raw ledger for ${creator.name}...\nWindow: Last ${days} days\nMinimum Spend: $${threshold}`, replyOpt);

        let rawTransactions: any[] = [];
        try {
            const txResponse = await getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);
            const allTx = txResponse.data?.list || txResponse.list || txResponse.transactions || [];

            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            rawTransactions = allTx.filter((t: any) => new Date(t.createdAt) >= cutoffDate);
        } catch (e) {
            console.error("Tx Fetch Error", e);
            return ctx.reply("⚠️ Failed to download raw transaction ledger from OnlyFans.", replyOpt);
        }

        const topFans = calculateTopFans(rawTransactions, threshold);

        if (topFans.length === 0) {
            return ctx.reply(`No fans found who spent over $${threshold} in this ledger slice.`, replyOpt);
        }

        // Output top 15 max to avoid telegram message length limits
        const displayList = topFans.slice(0, 15);

        let md = `TOP SPENDERS (${days}d > $${threshold})\n\n`;

        displayList.forEach((fan, index) => {
            md += `${index + 1}. ${fan.name} (@${fan.username}): $${fan.spend.toFixed(2)}\n`;
        });

        md += `\nTotal Whales Found: ${topFans.length}`;

        await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "HTML" as const }));

    } catch (e: any) {
        console.error("Topfans command error", e);
        await ctx.reply("⚠️ Failed to calculate top fans.", replyOpt);
    }
});

bot.command("list", async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);

        const creators = await prisma.creator.findMany({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (creators.length === 0) {
            return ctx.reply("❌ No Connected Accounts found in this channel scope.");
        }

        let msg = "🔗 <b>Connected Accounts:</b>\n\n";
        creators.forEach((c: any) => {
            const statusStr = (c.ofapiToken && c.ofapiToken !== "unlinked") ? "Linked ✅" : "Unlinked ❌";
            msg += `- ${c.name || 'Unknown'} (@${c.ofapiCreatorId || '?'})\n  Status: ${statusStr}\n\n`;
        });

        await ctx.reply(msg, { parse_mode: "HTML" });
    } catch (e: any) {
        console.error("List command error", e);
        await ctx.reply("⚠️ Failed to list accounts.");
    }
});





// Handle interactive button callbacks here in the future if needed...

// Handler for direct media uploads to the vault
bot.on(["message:photo", "message:video", "message:voice"], async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);

        if (!telegramId) return;

        // Verify sender is a registered creator by mapping their DM or Group ID
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            await ctx.reply("❌ You are not registered or your OnlyFans Account is not linked.");
            return;
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            await ctx.reply("❌ System API Key is missing in Vercel settings.");
            return;
        }

        await ctx.reply("Media received! Scanning with AI Safety model...");

        // 1. Get the file handle from Telegram
        let fileId = "";
        let fileName = "";
        let mimeType = "";

        if (ctx.message.photo) {
            // Photos come in arrays of sizes, grab the largest one
            fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            fileName = `photo_${Date.now()}.jpg`;
            mimeType = "image/jpeg";
        } else if (ctx.message.video) {
            fileId = ctx.message.video.file_id;
            fileName = `video_${Date.now()}.mp4`;
            mimeType = "video/mp4";
        } else if (ctx.message.voice) {
            fileId = ctx.message.voice.file_id;
            fileName = `voice_${Date.now()}.ogg`;
            mimeType = "audio/ogg";
        }

        const file = await ctx.api.getFile(fileId);
        const fileLink = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

        // 2. Download the buffer directly into memory
        const response = await fetch(fileLink);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 3. AI Safety Check
        const safetyResult = await analyzeMediaSafety(buffer, mimeType);

        if (!safetyResult.isSafe) {
            await ctx.reply(`❌ Upload rejected by AI Analyzer. Reason: ${safetyResult.reason || "NSFW policy violation."}`);
            return;
        }

        // 4. Upload to OnlyFans Vault with dynamic tags
        await ctx.reply("AI Scan Passed! Uploading to OnlyFans Vault and attaching tags...");

        const uploadResponse = await uploadToVault(
            creator.ofapiCreatorId || creator.telegramId,
            apiKey,
            buffer,
            fileName,
            safetyResult.title,
            safetyResult.description
        );

        // 5. Create "Meta Pixel" tracking asset
        await prisma.mediaAsset.create({
            data: {
                creatorId: creator.id,
                ofapiMediaId: uploadResponse.id || uploadResponse.prefixed_id || "vault_" + Date.now(),
                fileType: mimeType,
                originalName: fileName,
                totalRevenue: 0.00
            }
        });

        const successMd = `
Upload Complete [Track ID: ${uploadResponse.id || uploadResponse.prefixed_id || 'N/A'}]

Title: ${safetyResult.title}
Tags: ${safetyResult.description}

Your file is now securely stored in your Vault.
        `;

        await ctx.reply(successMd);
    } catch (e: any) {
        console.error("Direct Upload Handler Error:", e);
        await ctx.reply("Sorry, an error occurred while processing your vault upload: " + e.message);
    }
});

// Handle Interactive Button Clicks from Alerts
bot.on("callback_query:data", async (ctx) => {
    const threadId = ctx.callbackQuery.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    const data = ctx.callbackQuery.data;

    if (data === "action_skip" || data === "action_ack") {
        await ctx.answerCallbackQuery("Alert dismissed.");
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        return;
    }

    if (data.startsWith("alert_reply_")) {
        const parts = data.split("_");
        const type = parts[2]; // voice | video | text
        const fanId = parts[3];

        // Acknowledge the click to remove the loading spinner
        await ctx.answerCallbackQuery();

        let promptStr = "";
        if (type === "voice") promptStr = "🎤 Please record and send your Voice Note now. Our AI will auto-tag it and push it directly into your OnlyFans Vault.";
        if (type === "video") promptStr = "📹 Please upload your Video now. Our AI will auto-tag it and push it directly into your OnlyFans Vault.";
        if (type === "text") promptStr = "✍️ Please type your Text message now. (It will be automatically sent via the chat engine).";

        await ctx.reply(promptStr, replyOpt);
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    }
});

// We don't start polling because we will use Next.js API Webhook for serverless execution

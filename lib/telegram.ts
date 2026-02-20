import { Bot, InlineKeyboard } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

export const bot = new Bot(token);

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

bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to OnlyFans Essentials. Your account is connected. Waiting for alerts...");
});

// V7 Reporting Commands
bot.command("stats", async (ctx) => {
    try {
        // Ex: /stats 24h or /stats 7d
        const args = ctx.match || "24h";
        let hours = parseInt(args);
        if (isNaN(hours)) hours = 24;
        if (args.includes('d')) hours = parseInt(args) * 24;

        const telegramId = String(ctx.from?.id);
        const creator = await prisma.creator.findUnique({ where: { telegramId } });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("❌ You are not linked to an OnlyFans account.");
        }

        await ctx.reply(`📊 Fetching performance data for the last ${args}...`);

        const now = new Date();
        const startWindow = new Date(now.getTime() - (hours * 60 * 60 * 1000));

        const payload = {
            accounts: [creator.ofapiCreatorId || creator.telegramId],
            date_range: { start: startWindow.toISOString(), end: now.toISOString() }
        };

        const [summary, byType] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken, payload).catch(() => null),
            getTransactionsByType(creator.ofapiToken, payload).catch(() => null)
        ]);

        if (!summary) return ctx.reply("❌ API Error: Could not fetch transaction summary at this time.");

        const md = `
PERFORMANCE REPORT: ${creator.name}
Window: Last ${args}

Gross Revenue: $${(summary.gross || 0).toFixed(2)}
Net Profit: $${(summary.net || 0).toFixed(2)}
Platform Fees: $${(summary.fees || 0).toFixed(2)}

Breakdown:
- Subscriptions: $${(byType?.subscriptions || 0).toFixed(2)}
- Tips: $${(byType?.tips || 0).toFixed(2)}
- Messages: $${(byType?.messages || 0).toFixed(2)}
        `;

        await ctx.reply(md, { parse_mode: "Markdown" });

    } catch (e: any) {
        console.error("Stats command error", e);
        await ctx.reply("⚠️ Failed to generate report.");
    }
});

bot.command("forecast", async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        const creator = await prisma.creator.findUnique({ where: { telegramId } });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") return;

        await ctx.reply(`📈 Booting statistical modeling engine for ${creator.name}...`);

        // We look at the last 30 days to project the next 7
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const payload = {
            accounts: [creator.ofapiCreatorId || creator.telegramId],
            model: "ARIMA",
            date_range: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() }
        };

        const forecast = await getRevenueForecast(creator.ofapiToken, payload);

        const md = `
7-DAY REVENUE FORECAST:
Model: ARIMA

Forecasted Net: $${(forecast.projected_net || 0).toFixed(2)}
Confidence Interval: +/- $${(forecast.interval_variance || 0).toFixed(2)}

Note: This projection is based purely on the velocity of your last 30 days of standard transactions.
        `;

        await ctx.reply(md, { parse_mode: "Markdown" });

    } catch (e: any) {
        console.error("Forecast command error", e);
        await ctx.reply("⚠️ Failed to generate forecast.");
    }
});

bot.command("notifications", async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        const creator = await prisma.creator.findUnique({ where: { telegramId } });

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("❌ You are not linked.");
        }

        const counts = await getNotificationCounts(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);

        const md = `
UNREAD ALERTS: ${creator.name}

Messages: ${counts.messages || 0}
Tips: ${counts.tips || 0}
New Fans: ${counts.subscribers || 0}
         `;

        await ctx.reply(md, { parse_mode: "Markdown" });
    } catch (e: any) {
        console.error("Notifications command error", e);
        await ctx.reply("⚠️ Failed to fetch notification counts.");
    }
});

bot.command("topfans", async (ctx) => {
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
            return ctx.reply("❌ You are not linked to an OnlyFans account.");
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) return ctx.reply("❌ System API Key is missing.");

        await ctx.reply(`🔍 Analyzing raw ledger for ${creator.name}...\nWindow: Last ${days} days\nMinimum Spend: $${threshold}`);

        let rawTransactions: any[] = [];
        try {
            const txResponse = await getTransactions(creator.ofapiCreatorId || creator.telegramId, apiKey);
            rawTransactions = txResponse.list || txResponse.transactions || [];
        } catch (e) {
            console.error("Tx Fetch Error", e);
            return ctx.reply("⚠️ Failed to download raw transaction ledger from OnlyFans.");
        }

        const topFans = calculateTopFans(rawTransactions, threshold);

        if (topFans.length === 0) {
            return ctx.reply(`No fans found who spent over $${threshold} in this ledger slice.`);
        }

        // Output top 15 max to avoid telegram message length limits
        const displayList = topFans.slice(0, 15);

        let md = `TOP SPENDERS (${days}d > $${threshold})\n\n`;

        displayList.forEach((fan, index) => {
            md += `${index + 1}. @${fan.username}: $${fan.spend.toFixed(2)}\n`;
        });

        md += `\nTotal Whales Found: ${topFans.length}`;

        await ctx.reply(md, { parse_mode: "HTML" });

    } catch (e: any) {
        console.error("Topfans command error", e);
        await ctx.reply("⚠️ Failed to calculate top fans.");
    }
});

// ==========================================
// V11: On-Demand Demo Triggers
// ==========================================

bot.command("testwhale", async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        const fanId = "U1234567";
        const totalSpend = 520;

        const keyboard = new InlineKeyboard()
            .text("🎤 Voice Note", `alert_reply_voice_${fanId}`)
            .text("📹 Video", `alert_reply_video_${fanId}`)
            .text("✍️ Text", `alert_reply_text_${fanId}`)
            .text("Skip", "action_skip");

        const message = `
🐳 Whale Alert

Fan: Marcus T.
Spent today: $${totalSpend}
Lifetime: $4,200
On page: 8 months

He tipped $200 on your last PPV.

How do you want to respond?`;

        await ctx.reply(message, { reply_markup: keyboard });
    } catch (e) {
        console.error(e);
    }
});

bot.command("testchatter", async (ctx) => {
    try {
        const keyboard = new InlineKeyboard()
            .text("Message Manager", "action_msg_manager")
            .text("Acknowledge", "action_ack");

        const message = `
⚠️ CHATTER TARGET MISSED ⚠️

Account: "@AgencyMockAccount"
Revenue (Last Hour): $45
Target: $100

Chatters are currently falling behind the hourly revenue goal. Check the feed and course correct.`;

        await ctx.reply(message, { reply_markup: keyboard });
    } catch (e) {
        console.error(e);
    }
});

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

        await ctx.reply(promptStr);
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    }
});

// We don't start polling because we will use Next.js API Webhook for serverless execution

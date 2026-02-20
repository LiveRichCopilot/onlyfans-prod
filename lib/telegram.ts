import { Bot } from "grammy";

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
    getNotificationCounts
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

// Handler for direct media uploads to the vault
bot.on(["message:photo", "message:video", "message:voice"], async (ctx) => {
    try {
        const telegramId = String(ctx.from?.id);
        if (!telegramId) return;

        // Verify sender is a registered creator
        const creator = await prisma.creator.findUnique({
            where: { telegramId }
        });

        if (!creator || !creator.ofapiToken) {
            await ctx.reply("You are not registered or your OnlyFans API Token is missing.");
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
            creator.ofapiToken,
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

// We don't start polling because we will use Next.js API Webhook for serverless execution

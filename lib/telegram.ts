import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

export const bot = new Bot(token);

import { prisma } from "./prisma";
import { uploadToVault } from "./ofapi";
import { analyzeMediaSafety } from "./ai-analyzer";

bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to OnlyFans Essentials. Your account is connected. Waiting for alerts...");
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

        // 4. Upload to OnlyFans Vault
        await ctx.reply("AI Scan Passed! Uploading to OnlyFans Vault...");

        await uploadToVault(creator.ofapiToken, buffer, fileName);

        await ctx.reply(`✅ Success! ${fileName} has been securely uploaded to your Vault.`);
    } catch (e: any) {
        console.error("Direct Upload Handler Error:", e);
        await ctx.reply("Sorry, an error occurred while processing your vault upload: " + e.message);
    }
});

// We don't start polling because we will use Next.js API Webhook for serverless execution

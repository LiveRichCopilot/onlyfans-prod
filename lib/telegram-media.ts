import { bot } from "./telegram-bot";
import { prisma } from "./prisma";
import { uploadToVault, sendVaultMediaToFan } from "./ofapi";
import { analyzeMediaSafety } from "./ai-analyzer";

const token = process.env.TELEGRAM_BOT_TOKEN;

// Simple memory cache for mapping a Creator's next media upload to a specific Fan Chat
const activeReplies: Record<string, string> = {};

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

        // Route the fan destination securely to the creator's Telegram DM ID
        if (ctx.from?.id && fanId) {
            activeReplies[String(ctx.from.id)] = fanId;
        }

        // Acknowledge the click to remove the loading spinner
        await ctx.answerCallbackQuery();

        let promptStr = "";
        if (type === "voice") promptStr = "Please record and send your Voice Note now. Our AI will auto-tag it and push it directly into your OnlyFans Vault before sending it to the fan.";
        if (type === "video") promptStr = "Please upload your Video now. Our AI will auto-tag it and push it directly into your OnlyFans Vault before sending it to the fan.";
        if (type === "text") promptStr = "Please type your Text message now. (It will be automatically sent via the chat engine).";

        await ctx.reply(promptStr, replyOpt);
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
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
            await ctx.reply("You are not registered or your OnlyFans Account is not linked.");
            return;
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            await ctx.reply("System API Key is missing in Vercel settings.");
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

        // Telegram Bot API hard limit: getFile() only works for files under 20MB.
        const fileSize = ctx.message.video?.file_size || ctx.message.photo?.[ctx.message.photo.length - 1]?.file_size || ctx.message.voice?.file_size || 0;
        if (fileSize > 20 * 1024 * 1024) {
            const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
            try {
                const { createUploadToken } = await import("@/lib/upload-token");
                const uploadToken = createUploadToken(creator.id, creator.ofapiCreatorId!, 30);
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://onlyfans-prod.vercel.app";
                const uploadLink = `${appUrl}/upload?token=${uploadToken}`;
                await ctx.reply(
                    `That file is ${sizeMB}MB — too large for Telegram (20MB limit).\n\n` +
                    `Use this link to upload directly to your vault:\n${uploadLink}\n\n` +
                    `Link expires in 30 minutes.`
                );
            } catch {
                await ctx.reply(
                    `File too large (${sizeMB}MB). Telegram bots can only download files under 20MB.\n\n` +
                    `For larger files, upload directly to your OF vault at onlyfans.com.`
                );
            }
            return;
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
            await ctx.reply(`Upload rejected by AI Analyzer. Reason: ${safetyResult.reason || "NSFW policy violation."}`);
            return;
        }

        // 4. Upload to OnlyFans Vault with dynamic tags (hard limit 512 chars)
        await ctx.reply("AI Scan Passed! Uploading to OnlyFans Vault and attaching tags...");

        const safeTitle = (safetyResult.title || "").substring(0, 50);
        const safeDescription = (safetyResult.description || "").substring(0, 450);

        const uploadResponse = await uploadToVault(
            creator.ofapiCreatorId || creator.telegramId,
            apiKey,
            buffer,
            fileName
        );

        const newMediaId = uploadResponse.data?.id || uploadResponse.id || uploadResponse.prefixed_id;

        // 5. Create "Meta Pixel" tracking asset with AI Tags cached!
        await prisma.mediaAsset.create({
            data: {
                creatorId: creator.id,
                ofapiMediaId: String(newMediaId || "vault_" + Date.now()),
                fileType: mimeType,
                originalName: fileName,
                totalRevenue: 0.00,
                aiTitle: safeTitle,
                aiDescription: safeDescription
            }
        });

        // 6. Automatically dispatch to the specific Whale Chat if triggered via /report
        const targetFanId = activeReplies[telegramId];
        if (targetFanId && newMediaId) {
            await sendVaultMediaToFan(targetFanId, newMediaId, apiKey);
            // Clear the active session queue
            delete activeReplies[telegramId];

            await ctx.reply(`Direct Message Sent! The Vault media asset has successfully been forwarded to fan ID: ${targetFanId}.`);
        } else {
            const successMd = `
Upload Complete [ID: ${newMediaId || 'N/A'}]

AI Generated Title:
${safeTitle}

AI Suggested Caption:
${safeDescription}

This media is now stored natively in your Vault. You can easily attach it to a Mass Message from your Inbox.
`;
            await ctx.reply(successMd);
        }

    } catch (e: any) {
        console.error("Direct Upload Handler Error:", e);
        await ctx.reply("Sorry, an error occurred while processing your vault upload: " + e.message);
    }
});

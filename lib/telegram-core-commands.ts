import { bot, getOrBindCreator } from "./telegram-bot";
import { prisma } from "./prisma";
import { getNotificationCounts } from "./ofapi";

bot.command("start", async (ctx) => {
    try {
        let creator = await getOrBindCreator(ctx);
        if (creator) {
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
        const telegramGroupId = String(ctx.chat?.id);
        const telegramId = String(ctx.from?.id);
        const creator = await getOrBindCreator(ctx);
        await ctx.reply(`Pong! 🏓\nGroup ID: ${telegramGroupId}\nThread ID: ${threadId || 'None'}\nUser ID: ${telegramId}\nCreator Found: ${creator ? creator.name : 'NO'}`, replyOpt);
    } catch (e) {
        console.error(e);
        await ctx.reply("Ping failed internally.", replyOpt);
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
            return ctx.reply("No Connected Accounts found in this channel scope.");
        }

        let msg = "Connected Accounts:\n\n";
        creators.forEach((c: any) => {
            const statusStr = (c.ofapiToken && c.ofapiToken !== "unlinked") ? "Linked" : "Unlinked";
            msg += `- ${c.name || 'Unknown'} (@${c.ofapiCreatorId || '?'})\n  Status: ${statusStr}\n\n`;
        });

        await ctx.reply(msg);
    } catch (e: any) {
        console.error("List command error", e);
        await ctx.reply("Failed to list accounts.");
    }
});

bot.command("purchases", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) {
            return ctx.reply("No creator account linked.", replyOpt);
        }

        const arg = (ctx.match || "").trim().toLowerCase();

        if (arg === "on") {
            await prisma.creator.update({
                where: { id: creator.id },
                data: { purchaseAlertsEnabled: true }
            });
            return ctx.reply("Purchase notifications are now ON. You'll receive alerts for every tip, PPV unlock, and subscription.", replyOpt);
        }

        if (arg === "off") {
            await prisma.creator.update({
                where: { id: creator.id },
                data: { purchaseAlertsEnabled: false }
            });
            return ctx.reply("Purchase notifications are now OFF. Use /purchases on to re-enable.", replyOpt);
        }

        // No arg — show current status
        const status = (creator as any).purchaseAlertsEnabled !== false ? "ON" : "OFF";
        return ctx.reply(
            `Purchase Alerts: ${status}\n\nUsage:\n/purchases on — Enable alerts\n/purchases off — Disable alerts`,
            replyOpt
        );
    } catch (e: any) {
        console.error("Purchases command error:", e);
        await ctx.reply("Failed to update purchase alert settings.", replyOpt);
    }
});

bot.command("notifications", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("You are not linked.", replyOpt);
        }

        const counts = await getNotificationCounts(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);

        const md = `
UNREAD ALERTS: ${creator.name}

Messages: ${counts.messages || 0}
Tips: ${counts.tips || 0}
New Fans: ${counts.subscribers || 0}
         `;

        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Notifications command error", e);
        await ctx.reply("Failed to fetch notification counts.", replyOpt);
    }
});

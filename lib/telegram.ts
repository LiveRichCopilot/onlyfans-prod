import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
}

export const bot = new Bot(token);

bot.command("start", async (ctx) => {
    // the telegram webhook route will process this logic further down,
    // this is just an initialization of the command.
    await ctx.reply("Welcome to OnlyFans Essentials. Your account is connected. Waiting for alerts...");
});

// We don't start polling because we will use Next.js API Webhook for serverless execution

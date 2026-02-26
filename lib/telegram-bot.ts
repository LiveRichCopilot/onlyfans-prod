import { Bot } from "grammy";
import { prisma } from "./prisma";

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

export function timeAgo(date: Date | string): string {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}


export async function getOrBindCreator(ctx: any) {
    const telegramId = String(ctx.from?.id);
    const telegramGroupId = String(ctx.chat?.id);
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    let creator = await prisma.creator.findFirst({
        where: {
            OR: [
                { telegramId },
                { telegramGroupId }
            ]
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    // Cleanup ghost mock bot data if present
    if (creator && creator.ofapiToken === (process.env.TEST_OFAPI_KEY || "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5")) {
        await prisma.creator.delete({ where: { id: creator.id } });
        creator = null;
    }

    // Fallback logic for single-tenant DMs if they haven't bound their ID yet
    if (!creator && !isGroup && telegramId && telegramId !== "undefined") {
        let realCreator = await prisma.creator.findFirst({
            where: { ofapiToken: "linked_via_auth_module", telegramId: { in: ["", "unlinked"] } }
        });

        if (!realCreator) {
            realCreator = await prisma.creator.findFirst({
                where: { ofapiToken: "unlinked", telegramId: { in: ["", "unlinked"] } }
            });
        }

        if (realCreator) {
            creator = await prisma.creator.update({
                where: { id: realCreator.id },
                data: { telegramId }
            });
        }
    }

    return creator;
}

bot.catch((err) => {
    console.error("Global Grammy Error:", err);
});

// Configure Telegram Slash Command menu — only once, not on every cold start
// Use a global flag to prevent repeated calls across serverless instances
const commandsKey = "__tg_commands_set";
if (!(globalThis as any)[commandsKey]) {
    (globalThis as any)[commandsKey] = true;
    bot.api.setMyCommands([
        { command: "start", description: "Initialize Bot" },
        { command: "report", description: "Get the live 1H/24H Revenue Brief & Top Spenders" },
        { command: "stats", description: "Get comprehensive performance report (e.g. /stats 24h)" },
        { command: "topfans", description: "Find highest spenders (e.g. /topfans 1d 1000)" },
        { command: "forecast", description: "Generate AI revenue projection" },
        { command: "notifications", description: "Check unread priority alerts" },
        { command: "list", description: "List connected accounts" },
        { command: "purchases", description: "Toggle purchase alerts on/off (e.g. /purchases off)" },
        { command: "ping", description: "Check system latency and group ID" },
        { command: "mass", description: "Mass message performance — top earners & flops" },
        { command: "whales", description: "Top lifetime spenders from database" },
        { command: "hot", description: "High-intent fans ready to buy" },
        { command: "coolingoff", description: "Fans cooling off or at risk of churning" },
        { command: "compare", description: "Compare this week vs last week" },
        { command: "hourly", description: "Revenue by hour today" },
        { command: "breakdown", description: "Revenue split by type" },
        { command: "newfans", description: "New fans today + churn count" },
        { command: "scores", description: "Check chatter performance scores" }
    ]).catch(() => {}); // Silently ignore — commands are already set from previous deploys
}

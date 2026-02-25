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
    getNotificationCounts,
    sendVaultMediaToFan,
    getMe,
    updateVaultMedia,
    getMassMessages,
    getMassMessageChart,
    getStatisticsOverview,
} from "./ofapi";
import { analyzeMediaSafety } from "./ai-analyzer";

function timeAgo(date: Date | string): string {
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


async function getOrBindCreator(ctx: any) {
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

        const creator = await getOrBindCreator(ctx);

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("You are not linked to an OnlyFans account.", replyOpt);
        }

        let ofAccount = creator.ofapiCreatorId || creator.telegramId;
        let creatorName = creator.name;

        if (!creatorName || !ofAccount || Number.isNaN(Number(ofAccount)) || ofAccount === creator.telegramId) {
            try {
                const me = await getMe(ofAccount, creator.ofapiToken).catch(() => null);
                if (me) {
                    creatorName = me.name || creatorName || "Creator";
                    if (me.id) ofAccount = String(me.id);

                    await prisma.creator.update({
                        where: { id: creator.id },
                        data: { name: creatorName, ofapiCreatorId: ofAccount }
                    }).catch(() => null);
                }
            } catch (e) {
                // Ignore API failures during auto-heal
            }
        }

        creatorName = creatorName || "Creator";

        await ctx.reply(`Fetching performance data for ${creatorName} over the last ${args}...`, replyOpt);

        const now = new Date();
        const startWindow = new Date(now.getTime() - (hours * 60 * 60 * 1000));

        // Use LOCAL DB as source of truth — synced from OFAPI every 5 min
        const localTx = await prisma.transaction.findMany({
            where: { creatorId: creator.id, date: { gte: startWindow } },
            select: { amount: true, type: true },
        });

        let totalRevenue = 0;
        let subscriptions = 0;
        let tips = 0;
        let messages = 0;
        let other = 0;

        localTx.forEach((t) => {
            totalRevenue += t.amount;
            if (t.type === "tip") tips += t.amount;
            else if (t.type === "message") messages += t.amount;
            else if (t.type === "subscription") subscriptions += t.amount;
            else other += t.amount;
        });

        let md = `PERFORMANCE REPORT: ${creatorName}\nWindow: Last ${args}\n\n`;
        md += `Revenue: $${totalRevenue.toFixed(2)}\n`;
        md += `Transactions: ${localTx.length}\n\n`;
        md += `Breakdown:\n`;
        md += `- Subscriptions: $${subscriptions.toFixed(2)}\n`;
        md += `- Tips: $${tips.toFixed(2)}\n`;
        md += `- Messages/PPV: $${messages.toFixed(2)}\n`;
        if (other > 0) md += `- Other: $${other.toFixed(2)}\n`;

        await ctx.reply(md, replyOpt);

    } catch (e: any) {
        console.error("Stats command error", e);
        await ctx.reply("Failed to generate report.", replyOpt);
    }
});

bot.command("report", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("You are not linked.", replyOpt);
        }

        let ofAccount = creator.ofapiCreatorId || creator.telegramId;
        let creatorName = creator.name;

        if (!creatorName || !ofAccount || Number.isNaN(Number(ofAccount)) || ofAccount === creator.telegramId) {
            try {
                const me = await getMe(ofAccount, creator.ofapiToken).catch(() => null);
                if (me) {
                    creatorName = me.name || creatorName || "Creator";
                    if (me.id) ofAccount = String(me.id);

                    await prisma.creator.update({
                        where: { id: creator.id },
                        data: { name: creatorName, ofapiCreatorId: ofAccount }
                    }).catch(() => null);
                }
            } catch (e) {
                // Ignore API failures during auto-heal
            }
        }

        creatorName = creatorName || "Creator";

        await ctx.reply(`Compiling Live Daily Brief for ${creatorName}...`, replyOpt);

        const now = new Date();
        const start20m = new Date(now.getTime() - (20 * 60 * 1000));
        const start24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        // Use LOCAL DB as source of truth — synced from OFAPI every 5 min
        const [revenue20m, revenue24h, topFansData] = await Promise.all([
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: start20m } },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: start24h } },
                _sum: { amount: true },
            }),
            prisma.transaction.groupBy({
                by: ['fanId'],
                where: { creatorId: creator.id, date: { gte: start24h } },
                _sum: { amount: true },
                orderBy: { _sum: { amount: 'desc' } },
                take: 5,
            }),
        ]);

        const gross20m = (revenue20m._sum.amount || 0).toFixed(2);
        const gross24h = (revenue24h._sum.amount || 0).toFixed(2);

        // Resolve fan names
        const topFanIds = topFansData.filter(f => (f._sum.amount || 0) > 0).map(f => f.fanId);
        const fans = topFanIds.length > 0
            ? await prisma.fan.findMany({ where: { id: { in: topFanIds } }, select: { id: true, name: true, username: true } })
            : [];
        const fanMap = new Map(fans.map(f => [f.id, f]));

        const validSpenders = topFansData.filter(f => (f._sum.amount || 0) > 0);

        let md = `DAILY BRIEF: ${creatorName}\n\n`;
        md += `20-Minute Velocity: $${gross20m}\n`;
        md += `24-Hour Total: $${gross24h}\n\n`;
        md += `Top 3 Spenders [Last 24h]\n`;

        if (validSpenders.length === 0) {
            md += "No spenders found in the last 24h.\n";
            await ctx.reply(md, replyOpt);
        } else {
            const displayList = validSpenders.slice(0, 3);
            displayList.forEach((entry, i) => {
                const fan = fanMap.get(entry.fanId);
                const displayName = fan?.name || fan?.username || "Anonymous";
                const username = fan?.username || "?";
                md += `${i + 1}. ${displayName} (@${username}) — $${(entry._sum.amount || 0).toFixed(2)}\n`;
            });

            const topFan = fanMap.get(validSpenders[0].fanId);
            const topWhaleName = topFan?.name || topFan?.username || "Top Spender";
            const topWhaleUsername = topFan?.username || "unknown";
            md += `\nAction Required: Your #1 whale right now is ${topWhaleName}. Want to send them content or a voice note?`;

            const keyboard = new InlineKeyboard()
                .text("Voice Note", `alert_reply_voice_${topWhaleUsername}`).row()
                .text("Send Video", `alert_reply_video_${topWhaleUsername}`).row()
                .text("Skip / Dismiss", "action_skip");

            await ctx.reply(md, Object.assign({}, replyOpt, { reply_markup: keyboard }));
        }

    } catch (e: any) {
        console.error("Report command error", e);
        await ctx.reply("Failed to generate comprehensive report.", replyOpt);
    }
});

bot.command("forecast", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        await ctx.reply(`Computing forecast for ${creator.name || "Creator"}...`, replyOpt);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Use LOCAL DB — get weekly revenue for the last 4 weeks
        const [rev7d, rev14d, rev30d, txCount30d] = await Promise.all([
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: sevenDaysAgo } },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: thirtyDaysAgo } },
                _sum: { amount: true },
            }),
            prisma.transaction.count({
                where: { creatorId: creator.id, date: { gte: thirtyDaysAgo } },
            }),
        ]);

        const thisWeek = rev7d._sum.amount || 0;
        const lastWeek = rev14d._sum.amount || 0;
        const monthly = rev30d._sum.amount || 0;
        const dailyAvg = monthly / 30;
        const weeklyAvg = monthly / 4.3; // ~4.3 weeks in 30 days

        // Simple trend: weighted average of recent velocity
        // 70% this week's pace + 30% monthly average
        const projected7d = (thisWeek * 0.7) + (weeklyAvg * 0.3);
        const weekDelta = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : 0;
        const trend = weekDelta >= 5 ? "Trending UP" : weekDelta <= -5 ? "Trending DOWN" : "Holding steady";

        let md = `7-DAY REVENUE FORECAST — ${creator.name || "Creator"}\n\n`;
        md += `This week so far: $${thisWeek.toFixed(2)} (${rev7d._count} tx)\n`;
        md += `Last week: $${lastWeek.toFixed(2)}\n`;
        md += `30-day daily avg: $${dailyAvg.toFixed(2)}\n\n`;
        md += `Projected next 7 days: $${projected7d.toFixed(2)}\n`;
        md += `Week-over-week: ${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(1)}%\n`;
        md += `${trend}\n\n`;
        md += `Based on ${txCount30d} transactions over 30 days.`;

        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Forecast command error", e);
        await ctx.reply("Failed to generate forecast.", replyOpt);
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

bot.command("topfans", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const textStr = ctx.match || "";
        const parts = textStr.split(" ").filter(Boolean);

        let days = 1; // default 1 day
        if (parts.length > 0) {
            days = parseInt(parts[0].replace('d', '')) || 1;
        }

        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        let threshold = creator.whaleAlertTarget || 200;
        if (parts.length > 1) {
            threshold = parseFloat(parts[1]) || threshold;
        }

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Use LOCAL DB — synced from OFAPI every 5 min
        const topFansData = await prisma.transaction.groupBy({
            by: ['fanId'],
            where: { creatorId: creator.id, date: { gte: cutoff } },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 15,
        });

        const qualified = topFansData.filter(f => (f._sum.amount || 0) >= threshold);

        if (qualified.length === 0) {
            return ctx.reply(`No fans spent over $${threshold} in the last ${days}d.`, replyOpt);
        }

        // Resolve fan names
        const fanIds = qualified.map(f => f.fanId);
        const fans = await prisma.fan.findMany({
            where: { id: { in: fanIds } },
            select: { id: true, name: true, username: true },
        });
        const fanMap = new Map(fans.map(f => [f.id, f]));

        let md = `TOP SPENDERS (${days}d > $${threshold}) — ${creator.name || "Creator"}\n\n`;

        qualified.forEach((entry, i) => {
            const fan = fanMap.get(entry.fanId);
            const display = fan?.name || fan?.username || "Anonymous";
            const username = fan?.username || "?";
            md += `${i + 1}. ${display} (@${username}): $${(entry._sum.amount || 0).toFixed(2)}\n`;
        });

        md += `\nTotal: ${qualified.length} fans`;
        await ctx.reply(md, replyOpt);

    } catch (e: any) {
        console.error("Topfans command error", e);
        await ctx.reply("Failed to calculate top fans.", replyOpt);
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

// ========== NEW COMMANDS (V8) ==========

bot.command("mass", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("You are not linked to an OnlyFans account.", replyOpt);
        }

        const acct = creator.ofapiCreatorId || creator.telegramId;
        const creatorName = creator.name || "Creator";

        // Parse timeframe: /mass today, /mass 7d (default), /mass 30d
        const arg = (ctx.match || "7d").trim().toLowerCase();
        let days = 7;
        if (arg === "today") days = 1;
        else {
            const parsed = parseInt(arg.replace("d", ""));
            if (!isNaN(parsed) && parsed > 0) days = parsed;
        }
        const label = days === 1 ? "Today" : `Last ${days} Days`;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        await ctx.reply(`Fetching mass message stats for ${creatorName}...`, replyOpt);

        const res = await getMassMessages(acct, creator.ofapiToken, 50, 0).catch(() => null);
        const allMessages: any[] = Array.isArray(res) ? res : (res?.data?.list || res?.data || res?.list || res?.messages || []);

        if (!Array.isArray(allMessages) || allMessages.length === 0) {
            return ctx.reply("No mass messages found.", replyOpt);
        }

        // Filter to requested time window
        const filtered = allMessages.filter((m: any) => {
            const d = new Date(m.createdAt || m.created_at || m.postedAt || m.date || 0);
            return d >= cutoff;
        });

        if (filtered.length === 0) {
            return ctx.reply(`No mass messages found for ${creatorName} (${label}).`, replyOpt);
        }

        // Fetch chart data per message for revenue + compute open rates
        type ScoredMsg = { text: string; dateLabel: string; sent: number; viewed: number; openRate: number; revenue: number; buyers: number };
        const scored: ScoredMsg[] = [];

        const chartPromises = filtered.slice(0, 20).map(async (m: any) => {
            const msgId = m.id || m.message_id;
            let revenue = 0;
            let buyers = 0;

            if (msgId) {
                const chart = await getMassMessageChart(acct, creator.ofapiToken!, String(msgId)).catch(() => null);
                revenue = parseFloat(chart?.data?.revenue || chart?.data?.total_revenue || chart?.revenue || "0");
                buyers = parseInt(chart?.data?.buyers_count || chart?.data?.unlocks || chart?.buyers || "0", 10);
            }

            const sent = m.sentCount || m.sent_count || m.sent || 0;
            const viewed = m.viewedCount || m.viewed_count || m.viewed || m.openCount || 0;
            const openRate = sent > 0 ? (viewed / sent) * 100 : 0;
            const rawText = m.text || m.preview || m.content || "";
            const text = rawText.length > 30 ? rawText.substring(0, 30) + "..." : (rawText || "(no text)");
            const dateStr = m.createdAt || m.created_at || m.postedAt || m.date || "";
            const dateLabel = new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });

            return { text, dateLabel, sent, viewed, openRate, revenue, buyers } as ScoredMsg;
        });

        const results = await Promise.all(chartPromises);
        results.forEach(r => { if (r) scored.push(r); });

        // Top performers: sort by revenue, fallback to open rate
        const byPerformance = [...scored].sort((a, b) => {
            if (a.revenue !== b.revenue) return b.revenue - a.revenue;
            return b.openRate - a.openRate;
        });

        // Flops: lowest open rate (min 100 sent to filter noise)
        const flops = [...scored]
            .filter(m => m.sent > 100)
            .sort((a, b) => a.openRate - b.openRate);

        const fmtNum = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);

        let msg = `MASS MESSAGES — ${creatorName} (${label})\n\n`;

        msg += `Top Performers:\n`;
        byPerformance.slice(0, 5).forEach((m, i) => {
            msg += `${i + 1}. ${m.dateLabel} — "${m.text}" — Sent: ${fmtNum(m.sent)} | Viewed: ${fmtNum(m.viewed)} (${m.openRate.toFixed(1)}%)`;
            if (m.revenue > 0) msg += ` | $${m.revenue.toFixed(2)}`;
            msg += `\n`;
        });

        if (flops.length > 0) {
            msg += `\nFlops (Low Open Rate):\n`;
            flops.slice(0, 3).forEach((m, i) => {
                msg += `${i + 1}. ${m.dateLabel} — "${m.text}" — Sent: ${fmtNum(m.sent)} | Viewed: ${fmtNum(m.viewed)} (${m.openRate.toFixed(1)}%)\n`;
            });
        }

        msg += `\nTotal analyzed: ${scored.length}`;
        await ctx.reply(msg, replyOpt);
    } catch (e: any) {
        console.error("Mass command error:", e);
        await ctx.reply("Failed to fetch mass message stats.", replyOpt);
    }
});

bot.command("whales", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        const topFans = await prisma.fan.findMany({
            where: { creatorId: creator.id, lifetimeSpend: { gte: creator.whaleAlertTarget || 200 } },
            orderBy: { lifetimeSpend: "desc" },
            take: 15,
        });

        if (topFans.length === 0) {
            return ctx.reply(`No whales found (threshold: $${creator.whaleAlertTarget || 200}).`, replyOpt);
        }

        let md = `WHALES — ${creator.name || "Creator"} (>$${creator.whaleAlertTarget || 200})\n\n`;
        topFans.forEach((fan, i) => {
            const display = fan.name || fan.username || "Anonymous";
            const lastPurchase = fan.lastPurchaseAt ? timeAgo(fan.lastPurchaseAt) : "never";
            md += `${i + 1}. ${display} — $${(fan.lifetimeSpend || 0).toFixed(2)} (last: ${lastPurchase})\n`;
        });

        md += `\nTotal whales: ${topFans.length}`;
        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Whales command error:", e);
        await ctx.reply("Failed to fetch whales.", replyOpt);
    }
});

bot.command("hot", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        const hotFans = await prisma.fan.findMany({
            where: { creatorId: creator.id, intentScore: { gte: 50 } },
            orderBy: { intentScore: "desc" },
            take: 10,
        });

        if (hotFans.length === 0) {
            return ctx.reply("No high-intent fans detected yet. Intent builds from purchases and messages.", replyOpt);
        }

        let md = `HOT FANS — ${creator.name || "Creator"}\n\n`;
        hotFans.forEach((fan, i) => {
            const display = fan.name || fan.username || "Anonymous";
            const stage = fan.stage || "unknown";
            const lastIntent = fan.lastIntentAt ? timeAgo(fan.lastIntentAt) : "?";
            md += `${i + 1}. ${display} — Score: ${fan.intentScore}/100 | Stage: ${stage} | Last signal: ${lastIntent}\n`;
        });

        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Hot command error:", e);
        await ctx.reply("Failed to fetch hot fans.", replyOpt);
    }
});

bot.command("coolingoff", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        const coolingFans = await prisma.fan.findMany({
            where: {
                creatorId: creator.id,
                stage: { in: ["cooling_off", "at_risk", "churned"] },
            },
            orderBy: { lifetimeSpend: "desc" },
            take: 15,
        });

        if (coolingFans.length === 0) {
            return ctx.reply("No fans currently cooling off or at risk.", replyOpt);
        }

        let md = `COOLING OFF — ${creator.name || "Creator"}\n\n`;
        coolingFans.forEach((fan, i) => {
            const display = fan.name || fan.username || "Anonymous";
            const lastMsg = fan.lastMessageAt ? timeAgo(fan.lastMessageAt) : "never";
            const lastPurchase = fan.lastPurchaseAt ? timeAgo(fan.lastPurchaseAt) : "never";
            md += `${i + 1}. ${display} — $${(fan.lifetimeSpend || 0).toFixed(2)} lifetime | Stage: ${fan.stage} | Last msg: ${lastMsg} | Last buy: ${lastPurchase}\n`;
        });

        md += `\nTotal at risk: ${coolingFans.length}`;
        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Coolingoff command error:", e);
        await ctx.reply("Failed to fetch cooling off fans.", replyOpt);
    }
});

bot.command("compare", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        await ctx.reply(`Comparing weeks for ${creator.name || "Creator"}...`, replyOpt);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Use LOCAL DB as source of truth
        const [thisWeekAgg, lastWeekAgg, thisWeekCount, lastWeekCount] = await Promise.all([
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: sevenDaysAgo } },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: { creatorId: creator.id, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
                _sum: { amount: true },
            }),
            prisma.transaction.count({
                where: { creatorId: creator.id, date: { gte: sevenDaysAgo } },
            }),
            prisma.transaction.count({
                where: { creatorId: creator.id, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
            }),
        ]);

        const thisWeekTotal = thisWeekAgg._sum.amount || 0;
        const lastWeekTotal = lastWeekAgg._sum.amount || 0;
        const delta = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100) : 0;
        const arrow = delta >= 0 ? "+" : "";

        let md = `WEEK COMPARISON — ${creator.name || "Creator"}\n\n`;
        md += `This week (7d): $${thisWeekTotal.toFixed(2)} (${thisWeekCount} tx)\n`;
        md += `Last week: $${lastWeekTotal.toFixed(2)} (${lastWeekCount} tx)\n`;
        md += `Change: ${arrow}${delta.toFixed(1)}%\n`;

        if (delta >= 10) md += `\nTrending UP`;
        else if (delta <= -10) md += `\nTrending DOWN`;
        else md += `\nHolding steady`;

        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Compare command error:", e);
        await ctx.reply("Failed to compare weeks.", replyOpt);
    }
});

bot.command("hourly", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) {
            return ctx.reply("Not linked.", replyOpt);
        }

        // Use LOCAL DB as source of truth — not OFAPI analytics
        // (getTransactionsSummary doesn't support sub-daily granularity)
        const now = new Date();
        const todayUTC = new Date(now); todayUTC.setUTCHours(0, 0, 0, 0);

        const todayTx = await prisma.transaction.findMany({
            where: { creatorId: creator.id, date: { gte: todayUTC } },
            select: { amount: true, date: true },
            orderBy: { date: "asc" },
        });

        // Group by hour
        const hourBuckets: Record<number, number> = {};
        todayTx.forEach((t) => {
            const h = new Date(t.date).getUTCHours();
            hourBuckets[h] = (hourBuckets[h] || 0) + t.amount;
        });

        const currentHour = now.getUTCHours();
        let md = `HOURLY BREAKDOWN — ${creator.name || "Creator"}\n\n`;

        let totalToday = 0;
        for (let h = 0; h <= currentHour; h++) {
            const amt = hourBuckets[h] || 0;
            totalToday += amt;
            const bar = amt > 0 ? "\u2588".repeat(Math.min(Math.ceil(amt / 10), 20)) : "\u00B7";
            md += `${String(h).padStart(2, "0")}:00 $${amt.toFixed(0).padStart(6)} ${bar}\n`;
        }

        md += `\nTotal today: $${totalToday.toFixed(2)} across ${todayTx.length} transactions`;
        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Hourly command error:", e);
        await ctx.reply("Failed to fetch hourly breakdown.", replyOpt);
    }
});

bot.command("breakdown", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Use LOCAL DB as source of truth — synced from OFAPI every 5 min
        const byType = await prisma.transaction.groupBy({
            by: ['type'],
            where: { creatorId: creator.id, date: { gte: sevenDaysAgo } },
            _sum: { amount: true },
            _count: true,
        });

        const typeMap: Record<string, number> = {};
        let total = 0;
        byType.forEach(entry => {
            const t = entry.type || "other";
            const amt = entry._sum.amount || 0;
            typeMap[t] = (typeMap[t] || 0) + amt;
            total += amt;
        });

        const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) : "0";

        const tips = typeMap["tip"] || 0;
        const messages = typeMap["message"] || 0;
        const subs = typeMap["subscription"] || 0;
        const posts = typeMap["post"] || 0;
        const streams = typeMap["stream"] || 0;
        const otherAmount = total - tips - messages - subs - posts - streams;

        let md = `REVENUE BREAKDOWN (7d) — ${creator.name || "Creator"}\n\n`;
        if (tips > 0) md += `Tips: $${tips.toFixed(2)} (${pct(tips)}%)\n`;
        if (messages > 0) md += `PPV/Messages: $${messages.toFixed(2)} (${pct(messages)}%)\n`;
        if (subs > 0) md += `Subscriptions: $${subs.toFixed(2)} (${pct(subs)}%)\n`;
        if (posts > 0) md += `Posts: $${posts.toFixed(2)} (${pct(posts)}%)\n`;
        if (streams > 0) md += `Streams: $${streams.toFixed(2)} (${pct(streams)}%)\n`;
        if (otherAmount > 0) md += `Other: $${otherAmount.toFixed(2)} (${pct(otherAmount)}%)\n`;
        md += `\nTOTAL: $${total.toFixed(2)}`;

        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Breakdown command error:", e);
        await ctx.reply("Failed to fetch revenue breakdown.", replyOpt);
    }
});

bot.command("newfans", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        const now = new Date();
        const todayUTC = new Date(now); todayUTC.setUTCHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // New fans today (from DB — fans created today)
        const newFansToday = await prisma.fan.count({
            where: { creatorId: creator.id, createdAt: { gte: todayUTC } },
        });

        // New fans this week
        const newFansWeek = await prisma.fan.count({
            where: { creatorId: creator.id, createdAt: { gte: sevenDaysAgo } },
        });

        // Churned/at-risk fans
        const churned = await prisma.fan.count({
            where: { creatorId: creator.id, stage: { in: ["churned", "at_risk", "cooling_off"] } },
        });

        // Total active fans
        const totalActive = await prisma.fan.count({
            where: { creatorId: creator.id, stage: { notIn: ["churned"] } },
        });

        // Also try OFAPI statistics for subscriber data
        let ofNewSubs = 0;
        if (creator.ofapiToken && creator.ofapiToken !== "unlinked") {
            const acct = creator.ofapiCreatorId || creator.telegramId;
            const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
            const overview = await getStatisticsOverview(acct, creator.ofapiToken, fmt(sevenDaysAgo), fmt(now)).catch(() => null);
            ofNewSubs = overview?.data?.visitors?.subscriptions?.new?.total || 0;
        }

        let md = `FAN MOVEMENT — ${creator.name || "Creator"}\n\n`;
        md += `New fans today: ${newFansToday}\n`;
        md += `New fans (7d): ${newFansWeek}\n`;
        if (ofNewSubs > 0) md += `New subscribers (OF, 7d): ${ofNewSubs}\n`;
        md += `Cooling off / At risk: ${churned}\n`;
        md += `Total tracked fans: ${totalActive}`;

        await ctx.reply(md, replyOpt);
    } catch (e: any) {
        console.error("Newfans command error:", e);
        await ctx.reply("Failed to fetch fan movement data.", replyOpt);
    }
});

bot.command("scores", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) return ctx.reply("Not linked.", replyOpt);

        // Get live sessions for this creator
        const liveSessions = await prisma.chatterSession.findMany({
            where: { creatorId: creator.id, isLive: true },
            select: { email: true, clockIn: true },
        });

        // Get most recent hourly score per chatter for this creator (last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentScores = await prisma.chatterHourlyScore.findMany({
            where: { creatorId: creator.id, createdAt: { gte: oneDayAgo } },
            orderBy: { windowStart: "desc" },
        });

        // Get profiles for this creator
        const profiles = await prisma.chatterProfile.findMany({
            where: { creatorId: creator.id },
        });

        // Dedupe: most recent score per chatter
        const latestByChatter = new Map<string, typeof recentScores[0]>();
        for (const score of recentScores) {
            if (!latestByChatter.has(score.chatterEmail)) {
                latestByChatter.set(score.chatterEmail, score);
            }
        }

        const profileMap = new Map(profiles.map(p => [p.chatterEmail, p]));
        const liveEmails = new Set(liveSessions.map(s => s.email));

        // Collect all known chatters for this creator
        const allEmails = new Set([
            ...latestByChatter.keys(),
            ...profileMap.keys(),
            ...liveEmails,
        ]);

        if (allEmails.size === 0) {
            return ctx.reply(`No chatter data found for ${creator.name || "this creator"}.`, replyOpt);
        }

        const archetypeLabels: Record<string, string> = {
            yes_babe_robot: "Yes Babe Robot",
            interview_bot: "Interview Bot",
            doormat: "Doormat",
            commander: "Commander",
            tease: "Tease",
            chameleon: "Chameleon",
        };

        let msg = `CHATTER SCORES — ${creator.name || "Creator"}\n\n`;

        // Sort: live first, then by score desc
        const entries = Array.from(allEmails).map(email => {
            const score = latestByChatter.get(email);
            const profile = profileMap.get(email);
            const isLive = liveEmails.has(email);
            const displayScore = score?.totalScore ?? Math.round(profile?.avgTotalScore ?? 0);
            const name = profile?.chatterName || email.split("@")[0];
            return { email, name, score, profile, isLive, displayScore };
        }).sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            return b.displayScore - a.displayScore;
        });

        for (const entry of entries.slice(0, 10)) {
            const emoji = entry.displayScore >= 80 ? "🟢" : entry.displayScore >= 50 ? "🟡" : "🔴";
            const liveTag = entry.isLive ? " [LIVE]" : "";
            msg += `${emoji} ${entry.name}${liveTag}: ${entry.displayScore}/100\n`;

            if (entry.score) {
                msg += `   SLA: ${entry.score.slaScore}/25 | FU: ${entry.score.followupScore}/20 | Trig: ${entry.score.triggerScore}/20 | Qual: ${entry.score.qualityScore}/20 | Rev: ${entry.score.revenueScore}/15\n`;
            }

            const archetype = entry.score?.detectedArchetype || entry.profile?.dominantArchetype;
            if (archetype) {
                msg += `   Style: ${archetypeLabels[archetype] || archetype}\n`;
            }

            if (entry.profile && entry.profile.improvementIndex !== 0) {
                const arrow = entry.profile.improvementIndex > 0 ? "+" : "";
                msg += `   Trend: ${arrow}${entry.profile.improvementIndex.toFixed(1)} | Sessions: ${entry.profile.totalScoringSessions}\n`;
            }

            msg += "\n";
        }

        const liveCount = entries.filter(e => e.isLive).length;
        msg += `Live: ${liveCount} | Total tracked: ${entries.length}`;

        await ctx.reply(msg, replyOpt);
    } catch (e: any) {
        console.error("Scores command error:", e);
        await ctx.reply("Failed to fetch chatter scores.", replyOpt);
    }
});

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
            const creatorName = creator.name || creator.ofUsername || "this account";
            const mediaType = ctx.message.video ? "video" : ctx.message.voice ? "voice" : "photo";
            let tips = "";
            if (mediaType === "video") {
                tips = "To fit under 20MB:\n" +
                    "- 720p + under 20 seconds\n" +
                    "- Or 480p for longer clips\n" +
                    "- Avoid sending as 'Original' quality";
            } else if (mediaType === "voice") {
                tips = "Voice notes should be under ~2 minutes to stay under 20MB.";
            } else {
                tips = "Send as photos (not documents) and fewer at a time (5-10 max).";
            }
            await ctx.reply(
                `File too large (${sizeMB}MB). Telegram bots can only download files under 20MB.\n\n` +
                `${tips}\n\n` +
                `For larger files, upload directly to your OF vault at onlyfans.com.`
            );
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

// We don't start polling because we will use Next.js API Webhook for serverless execution

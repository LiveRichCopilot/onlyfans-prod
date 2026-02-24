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
    fetchAllTransactions,
    calculateTopFans,
    sendVaultMediaToFan,
    getMe,
    updateVaultMedia,
    getMassMessages,
    getMassMessageChart,
    getStatisticsOverview,
    getEarningsByType
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
        { command: "newfans", description: "New fans today + churn count" }
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

        const payload = {
            account_ids: [ofAccount],
            start_date: startWindow.toISOString(),
            end_date: now.toISOString()
        };

        const allTx = await fetchAllTransactions(ofAccount, creator.ofapiToken, startWindow);

        const rawTxs = allTx.filter((t: any) => new Date(t.createdAt) >= startWindow);

        let totalGross = 0;
        let subscriptions = 0;
        let tips = 0;
        let messages = 0;

        rawTxs.forEach((t: any) => {
            const amt = parseFloat(t.amount || t.gross || t.price || "0");
            totalGross += amt;
            // Best effort categorization since OF drops labels in raw payload without deep parsing
            if (t.description?.toLowerCase().includes("tip")) tips += amt;
            else if (t.description?.toLowerCase().includes("message")) messages += amt;
            else subscriptions += amt;
        });

        // Hardcoded flat 20% OF Fee
        const totalNet = totalGross * 0.8;
        const totalFees = totalGross * 0.2;

        const md = `
PERFORMANCE REPORT: ${creatorName}
Window: Last ${args}

Gross Revenue: $${totalGross.toFixed(2)}
Net Profit: $${totalNet.toFixed(2)}
Platform Fees: $${totalFees.toFixed(2)}

Breakdown (Est.):
- Subscriptions: $${subscriptions.toFixed(2)}
- Tips: $${tips.toFixed(2)}
- Messages: $${messages.toFixed(2)}
        `;

        await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));

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

        const payload20m = {
            account_ids: [ofAccount],
            start_date: start20m.toISOString(),
            end_date: now.toISOString()
        };
        const payload24h = {
            account_ids: [ofAccount],
            start_date: start24h.toISOString(),
            end_date: now.toISOString()
        };

        const [summary20m, summary24h, allTx] = await Promise.all([
            getTransactionsSummary(creator.ofapiToken, payload20m).catch(() => null),
            getTransactionsSummary(creator.ofapiToken, payload24h).catch(() => null),
            fetchAllTransactions(ofAccount, creator.ofapiToken, start24h).catch(() => [])
        ]);
        const rawTxs = allTx.filter((t: any) => new Date(t.createdAt) >= start24h);

        // The OF Analytics summary endpoint ignores hours and rounds to days.
        // To get true 20-minute velocity, we manually sum the raw ledger events from the last 20 mins.
        const txs20m = allTx.filter((t: any) => new Date(t.createdAt) >= start20m);
        const manualGross20m = txs20m.reduce((sum: number, t: any) => {
            return sum + (parseFloat(t.amount || t.gross || t.price || "0"));
        }, 0);

        const manualGross24h = rawTxs.reduce((sum: number, t: any) => {
            return sum + (parseFloat(t.amount || t.gross || t.price || "0"));
        }, 0);

        const gross20m = manualGross20m.toFixed(2);
        const gross24h = manualGross24h.toFixed(2);

        const topFans = calculateTopFans(rawTxs, 0);

        const validSpenders = topFans.filter(f => f.spend > 0);

        let md = `🔥 **DAILY BRIEF**: ${creatorName}\n\n`;
        md += `⏱ **20-Minute Velocity:** $${gross20m}\n`;
        md += `📅 **24-Hour Total:** $${gross24h}\n\n`;
        md += `🏆 **Top 3 Spenders [Last 24h]**\n`;

        if (validSpenders.length === 0) {
            md += "No spenders found in the last 24h.\n";
            await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));
        } else {
            const displayList = validSpenders.slice(0, 3);
            displayList.forEach((fan, i) => {
                md += `${i + 1}. ${fan.name} (@${fan.username}) — $${fan.spend.toFixed(2)}\n`;
            });

            const topWhale = validSpenders[0];
            md += `\n🎯 **Action Required:** Your #1 whale right now is ${topWhale.name}. Would you like to send them a private reward or voice note to their inbox?`;

            const keyboard = new InlineKeyboard()
                .text("🎤 Voice Note", `alert_reply_voice_${topWhale.username}`).row()
                .text("📹 Send Video", `alert_reply_video_${topWhale.username}`).row()
                .text("Skip / Dismiss", "action_skip");

            await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const, reply_markup: keyboard }));
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

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") return;

        await ctx.reply(`Booting statistical modeling engine for ${creator.name}...`, replyOpt);

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

        await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" as const }));
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

        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("You are not linked to an OnlyFans account.", replyOpt);
        }

        let threshold = creator.whaleAlertTarget || 500; // default minimum
        if (parts.length > 1) {
            threshold = parseFloat(parts[1]) || threshold;
        }

        await ctx.reply(`Analyzing raw ledger for ${creator.name}...\nWindow: Last ${days} days\nMinimum Spend: $${threshold} (from module)`, replyOpt);

        let rawTransactions: any[] = [];
        try {
            const txResponse = await getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);
            const allTx = txResponse.data?.list || txResponse.list || txResponse.transactions || [];

            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            rawTransactions = allTx.filter((t: any) => new Date(t.createdAt) >= cutoffDate);
        } catch (e) {
            console.error("Tx Fetch Error", e);
            return ctx.reply("Failed to download raw transaction ledger from OnlyFans.", replyOpt);
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
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("Not linked.", replyOpt);
        }

        const acct = creator.ofapiCreatorId || creator.telegramId;
        await ctx.reply(`Comparing weeks for ${creator.name || "Creator"}...`, replyOpt);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const [thisWeekTx, lastWeekTx] = await Promise.all([
            fetchAllTransactions(acct, creator.ofapiToken, sevenDaysAgo, 1000).catch(() => []),
            fetchAllTransactions(acct, creator.ofapiToken, fourteenDaysAgo, 2000).catch(() => []),
        ]);

        const thisWeekArr = Array.isArray(thisWeekTx) ? thisWeekTx.filter((t: any) => new Date(t.createdAt) >= sevenDaysAgo) : [];
        const lastWeekArr = Array.isArray(lastWeekTx) ? lastWeekTx.filter((t: any) => {
            const d = new Date(t.createdAt);
            return d >= fourteenDaysAgo && d < sevenDaysAgo;
        }) : [];

        const sumTx = (txs: any[]) => txs.reduce((s, t) => s + (parseFloat(t.amount || "0")), 0);
        const thisWeekTotal = sumTx(thisWeekArr);
        const lastWeekTotal = sumTx(lastWeekArr);
        const delta = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100) : 0;
        const arrow = delta >= 0 ? "+" : "";

        let md = `WEEK COMPARISON — ${creator.name || "Creator"}\n\n`;
        md += `This week (7d): $${thisWeekTotal.toFixed(2)} (${thisWeekArr.length} tx)\n`;
        md += `Last week: $${lastWeekTotal.toFixed(2)} (${lastWeekArr.length} tx)\n`;
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
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("Not linked.", replyOpt);
        }

        const acct = creator.ofapiCreatorId || creator.telegramId;
        const now = new Date();
        const todayUTC = new Date(now); todayUTC.setUTCHours(0, 0, 0, 0);

        const txRes = await getTransactions(acct, creator.ofapiToken).catch(() => null);
        const allTx = txRes?.data?.list || txRes?.list || txRes?.transactions || [];
        const todayTx = allTx.filter((t: any) => new Date(t.createdAt) >= todayUTC);

        // Group by hour
        const hourBuckets: Record<number, number> = {};
        todayTx.forEach((t: any) => {
            const h = new Date(t.createdAt).getUTCHours();
            hourBuckets[h] = (hourBuckets[h] || 0) + (parseFloat(t.amount || "0"));
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
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return ctx.reply("Not linked.", replyOpt);
        }

        const acct = creator.ofapiCreatorId || creator.telegramId;
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

        await ctx.reply(`Fetching revenue breakdown for ${creator.name || "Creator"}...`, replyOpt);

        const [tipRes, msgRes, postRes, subRes, streamRes, overviewRes] = await Promise.all([
            getEarningsByType(acct, creator.ofapiToken, "tips", fmt(sevenDaysAgo), fmt(now)).catch(() => null),
            getEarningsByType(acct, creator.ofapiToken, "messages", fmt(sevenDaysAgo), fmt(now)).catch(() => null),
            getEarningsByType(acct, creator.ofapiToken, "post", fmt(sevenDaysAgo), fmt(now)).catch(() => null),
            getEarningsByType(acct, creator.ofapiToken, "subscribes", fmt(sevenDaysAgo), fmt(now)).catch(() => null),
            getEarningsByType(acct, creator.ofapiToken, "stream", fmt(sevenDaysAgo), fmt(now)).catch(() => null),
            getStatisticsOverview(acct, creator.ofapiToken, fmt(sevenDaysAgo), fmt(now)).catch(() => null),
        ]);

        const parseEarning = (res: any, k: string) => {
            const d = res?.data?.[k] || res?.data || {};
            return parseFloat(d.gross || d.total || "0");
        };

        const tips = parseEarning(tipRes, "tips");
        const messages = parseEarning(msgRes, "chat_messages");
        const posts = parseEarning(postRes, "post");
        const subs = parseEarning(subRes, "subscribes");
        const streams = parseEarning(streamRes, "stream");
        const ov = overviewRes?.data || {};
        const massEarnings = ov.massMessages?.earnings?.gross || 0;

        const total = tips + messages + posts + subs + streams;
        const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) : "0";

        let md = `REVENUE BREAKDOWN (7d) — ${creator.name || "Creator"}\n\n`;
        md += `Tips: $${tips.toFixed(2)} (${pct(tips)}%)\n`;
        md += `PPV/Messages: $${messages.toFixed(2)} (${pct(messages)}%)\n`;
        md += `Posts: $${posts.toFixed(2)} (${pct(posts)}%)\n`;
        md += `Subscriptions: $${subs.toFixed(2)} (${pct(subs)}%)\n`;
        md += `Streams: $${streams.toFixed(2)} (${pct(streams)}%)\n`;
        if (massEarnings > 0) md += `Mass Messages: $${massEarnings.toFixed(2)}\n`;
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
        // For larger files, give a direct dashboard upload link instead of a cryptic error.
        const fileSize = ctx.message.video?.file_size || ctx.message.photo?.[ctx.message.photo.length - 1]?.file_size || ctx.message.voice?.file_size || 0;
        if (fileSize > 20 * 1024 * 1024) {
            const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
            const dashUrl = `https://onlyfans-prod.vercel.app/inbox`;
            await ctx.reply(
                `That file is ${sizeMB}MB — Telegram's bot API caps downloads at 20MB.\n\n` +
                `Upload it directly through your dashboard instead:\n${dashUrl}\n\n` +
                `Just drag and drop the file into any chat's Vault attachment.`,
                { parse_mode: undefined }
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

import { InlineKeyboard } from "grammy";
import { bot, getOrBindCreator } from "./telegram-bot";
import { prisma } from "./prisma";
import { getMe } from "./ofapi";

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

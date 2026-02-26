import { bot, getOrBindCreator } from "./telegram-bot";
import { prisma } from "./prisma";
import { getMassMessages, getMassMessageChart } from "./ofapi";

bot.command("hourly", async (ctx) => {
    const threadId = ctx.message?.message_thread_id;
    const replyOpt = threadId ? { message_thread_id: threadId } : {};

    try {
        const creator = await getOrBindCreator(ctx);
        if (!creator) {
            return ctx.reply("Not linked.", replyOpt);
        }

        // Use LOCAL DB as source of truth — not OFAPI analytics
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

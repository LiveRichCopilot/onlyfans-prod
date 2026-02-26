import { bot, getOrBindCreator, timeAgo } from "./telegram-bot";
import { prisma } from "./prisma";
import { getStatisticsOverview } from "./ofapi";

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

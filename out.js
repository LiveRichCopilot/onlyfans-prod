"use strict";
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
  calculateTopFans,
  sendVaultMediaToFan
} from "./ofapi";
import { analyzeMediaSafety } from "./ai-analyzer";
async function getOrBindCreator(ctx) {
  const telegramId = String(ctx.from?.id);
  const telegramGroupId = String(ctx.chat?.id);
  let creator = await prisma.creator.findFirst({
    where: {
      OR: [
        { telegramId },
        { telegramGroupId }
      ]
    }
  });
  if (creator && creator.ofapiToken === (process.env.TEST_OFAPI_KEY || "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5")) {
    await prisma.creator.delete({ where: { id: creator.id } });
    creator = null;
  }
  if (!creator && telegramId && telegramId !== "undefined") {
    let realCreator = await prisma.creator.findFirst({
      where: { ofapiToken: "linked_via_auth_module" }
    });
    if (!realCreator) {
      realCreator = await prisma.creator.findFirst({
        where: { ofapiToken: "unlinked" }
      });
    }
    if (realCreator) {
      creator = await prisma.creator.update({
        where: { id: realCreator.id },
        data: {
          telegramId,
          telegramGroupId: ctx.chat?.type === "group" || ctx.chat?.type === "supergroup" ? telegramGroupId : realCreator.telegramGroupId
        }
      });
    }
  }
  if (creator && (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") && creator.telegramGroupId !== telegramGroupId) {
    creator = await prisma.creator.update({
      where: { id: creator.id },
      data: { telegramGroupId }
    });
  }
  return creator;
}
bot.catch((err) => {
  console.error("Global Grammy Error:", err);
});
bot.api.setMyCommands([
  { command: "start", description: "Initialize Bot" },
  { command: "report", description: "Get the live 1H/24H Revenue Brief & Top Spenders" },
  { command: "stats", description: "Get comprehensive performance report (e.g. /stats 24h)" },
  { command: "topfans", description: "Find highest spenders (e.g. /topfans 1d 1000)" },
  { command: "forecast", description: "Generate AI revenue projection" },
  { command: "notifications", description: "Check unread priority alerts" },
  { command: "list", description: "List connected accounts" },
  { command: "ping", description: "Check system latency and group ID" }
]).catch((err) => console.error("Failed to set commands", err));
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
    await ctx.reply(`Pong! \u{1F3D3}
Group ID: ${telegramGroupId}
Thread ID: ${threadId || "None"}
User ID: ${telegramId}
Creator Found: ${creator ? creator.name : "NO"}`, replyOpt);
  } catch (e) {
    console.error(e);
    await ctx.reply("Ping failed internally.", replyOpt);
  }
});
bot.command("stats", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  const replyOpt = threadId ? { message_thread_id: threadId } : {};
  try {
    const args = ctx.match || "24h";
    let hours = parseInt(args);
    if (isNaN(hours)) hours = 24;
    if (args.includes("d")) hours = parseInt(args) * 24;
    const creator = await getOrBindCreator(ctx);
    if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
      return ctx.reply("\u274C You are not linked to an OnlyFans account.", replyOpt);
    }
    await ctx.reply(`\u{1F4CA} Fetching performance data for the last ${args}...`, replyOpt);
    const now = /* @__PURE__ */ new Date();
    const startWindow = new Date(now.getTime() - hours * 60 * 60 * 1e3);
    const payload = {
      account_ids: [creator.ofapiCreatorId || creator.telegramId],
      start_date: startWindow.toISOString(),
      end_date: now.toISOString()
    };
    const [summary, byType] = await Promise.all([
      getTransactionsSummary(creator.ofapiToken, payload).catch(() => null),
      getTransactionsByType(creator.ofapiToken, payload).catch(() => null)
    ]);
    if (!summary) return ctx.reply("\u274C API Error: Could not fetch transaction summary at this time.");
    const summaryData = summary?.data || {};
    const md = `
PERFORMANCE REPORT: ${creator.name}
Window: Last ${args}

Gross Revenue: $${parseFloat(summaryData.total_gross || "0").toFixed(2)}
Net Profit: $${parseFloat(summaryData.total_net || "0").toFixed(2)}
Platform Fees: $${parseFloat(summaryData.total_fees || "0").toFixed(2)}

Breakdown:
- Subscriptions: $${(byType?.subscriptions || 0).toFixed(2)}
- Tips: $${(byType?.tips || 0).toFixed(2)}
- Messages: $${(byType?.messages || 0).toFixed(2)}
        `;
    await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" }));
  } catch (e) {
    console.error("Stats command error", e);
    await ctx.reply("\u26A0\uFE0F Failed to generate report.", replyOpt);
  }
});
bot.command("report", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  const replyOpt = threadId ? { message_thread_id: threadId } : {};
  try {
    const creator = await getOrBindCreator(ctx);
    if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
      return ctx.reply("\u274C You are not linked.", replyOpt);
    }
    await ctx.reply(`\u{1F4CA} Compiling Live Daily Brief for ${creator.name}...`, replyOpt);
    const now = /* @__PURE__ */ new Date();
    const start1h = new Date(now.getTime() - 1 * 60 * 60 * 1e3);
    const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
    const payload1h = {
      account_ids: [creator.ofapiCreatorId || creator.telegramId],
      start_date: start1h.toISOString(),
      end_date: now.toISOString()
    };
    const payload24h = {
      account_ids: [creator.ofapiCreatorId || creator.telegramId],
      start_date: start24h.toISOString(),
      end_date: now.toISOString()
    };
    const [summary1h, summary24h, txResponse] = await Promise.all([
      getTransactionsSummary(creator.ofapiToken, payload1h).catch(() => null),
      getTransactionsSummary(creator.ofapiToken, payload24h).catch(() => null),
      getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken).catch(() => null)
    ]);
    const gross1h = parseFloat(summary1h?.data?.total_gross || "0").toFixed(2);
    const gross24h = parseFloat(summary24h?.data?.total_gross || "0").toFixed(2);
    const allTx = txResponse?.data?.list || txResponse?.list || txResponse?.transactions || [];
    const rawTxs = allTx.filter((t) => new Date(t.createdAt) >= start24h);
    const topFans = calculateTopFans(rawTxs, 0);
    const validSpenders = topFans.filter((f) => f.spend > 0);
    let md = `\u{1F525} **DAILY BRIEF**: ${creator.name}

`;
    md += `\u23F1 **1-Hour Velocity:** $${gross1h}
`;
    md += `\u{1F4C5} **24-Hour Total:** $${gross24h}

`;
    md += `\u{1F3C6} **Top 3 Spenders [Last 24h]**
`;
    if (validSpenders.length === 0) {
      md += "No spenders found in the last 24h.\n";
      await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" }));
    } else {
      const displayList = validSpenders.slice(0, 3);
      displayList.forEach((fan, i) => {
        md += `${i + 1}. ${fan.name} (@${fan.username}) \u2014 $${fan.spend.toFixed(2)}
`;
      });
      const topWhale = validSpenders[0];
      md += `
\u{1F3AF} **Action Required:** Your #1 whale right now is ${topWhale.name}. Would you like to send them a private reward or voice note to their inbox?`;
      const keyboard = new InlineKeyboard().text("\u{1F3A4} Voice Note", `alert_reply_voice_${topWhale.username}`).row().text("\u{1F4F9} Send Video", `alert_reply_video_${topWhale.username}`).row().text("Skip / Dismiss", "action_skip");
      await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown", reply_markup: keyboard }));
    }
  } catch (e) {
    console.error("Report command error", e);
    await ctx.reply("\u26A0\uFE0F Failed to generate comprehensive report.", replyOpt);
  }
});
bot.command("forecast", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  const replyOpt = threadId ? { message_thread_id: threadId } : {};
  try {
    const creator = await getOrBindCreator(ctx);
    if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") return;
    await ctx.reply(`\u{1F4C8} Booting statistical modeling engine for ${creator.name}...`, replyOpt);
    const now = /* @__PURE__ */ new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
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
    await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" }));
  } catch (e) {
    console.error("Forecast command error", e);
    await ctx.reply("\u26A0\uFE0F Failed to generate forecast.", replyOpt);
  }
});
bot.command("notifications", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  const replyOpt = threadId ? { message_thread_id: threadId } : {};
  try {
    const creator = await getOrBindCreator(ctx);
    if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
      return ctx.reply("\u274C You are not linked.", replyOpt);
    }
    const counts = await getNotificationCounts(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);
    const md = `
UNREAD ALERTS: ${creator.name}

Messages: ${counts.messages || 0}
Tips: ${counts.tips || 0}
New Fans: ${counts.subscribers || 0}
         `;
    await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "Markdown" }));
  } catch (e) {
    console.error("Notifications command error", e);
    await ctx.reply("\u26A0\uFE0F Failed to fetch notification counts.", replyOpt);
  }
});
bot.command("topfans", async (ctx) => {
  const threadId = ctx.message?.message_thread_id;
  const replyOpt = threadId ? { message_thread_id: threadId } : {};
  try {
    const textStr = ctx.match || "";
    const parts = textStr.split(" ").filter(Boolean);
    let days = 1;
    let threshold = 1e3;
    if (parts.length > 0) {
      days = parseInt(parts[0].replace("d", "")) || 1;
    }
    if (parts.length > 1) {
      threshold = parseFloat(parts[1]) || 1e3;
    }
    const creator = await getOrBindCreator(ctx);
    if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
      return ctx.reply("\u274C You are not linked to an OnlyFans account.", replyOpt);
    }
    await ctx.reply(`\u{1F50D} Analyzing raw ledger for ${creator.name}...
Window: Last ${days} days
Minimum Spend: $${threshold}`, replyOpt);
    let rawTransactions = [];
    try {
      const txResponse = await getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);
      const allTx = txResponse.data?.list || txResponse.list || txResponse.transactions || [];
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
      rawTransactions = allTx.filter((t) => new Date(t.createdAt) >= cutoffDate);
    } catch (e) {
      console.error("Tx Fetch Error", e);
      return ctx.reply("\u26A0\uFE0F Failed to download raw transaction ledger from OnlyFans.", replyOpt);
    }
    const topFans = calculateTopFans(rawTransactions, threshold);
    if (topFans.length === 0) {
      return ctx.reply(`No fans found who spent over $${threshold} in this ledger slice.`, replyOpt);
    }
    const displayList = topFans.slice(0, 15);
    let md = `TOP SPENDERS (${days}d > $${threshold})

`;
    displayList.forEach((fan, index) => {
      md += `${index + 1}. ${fan.name} (@${fan.username}): $${fan.spend.toFixed(2)}
`;
    });
    md += `
Total Whales Found: ${topFans.length}`;
    await ctx.reply(md, Object.assign({}, replyOpt, { parse_mode: "HTML" }));
  } catch (e) {
    console.error("Topfans command error", e);
    await ctx.reply("\u26A0\uFE0F Failed to calculate top fans.", replyOpt);
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
      return ctx.reply("\u274C No Connected Accounts found in this channel scope.");
    }
    let msg = "\u{1F517} <b>Connected Accounts:</b>\n\n";
    creators.forEach((c) => {
      const statusStr = c.ofapiToken && c.ofapiToken !== "unlinked" ? "Linked \u2705" : "Unlinked \u274C";
      msg += `- ${c.name || "Unknown"} (@${c.ofapiCreatorId || "?"})
  Status: ${statusStr}

`;
    });
    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (e) {
    console.error("List command error", e);
    await ctx.reply("\u26A0\uFE0F Failed to list accounts.");
  }
});
const activeReplies = {};
bot.on("callback_query:data", async (ctx) => {
  const threadId = ctx.callbackQuery.message?.message_thread_id;
  const replyOpt = threadId ? { message_thread_id: threadId } : {};
  const data = ctx.callbackQuery.data;
  if (data === "action_skip" || data === "action_ack") {
    await ctx.answerCallbackQuery("Alert dismissed.");
    await ctx.editMessageReplyMarkup({ reply_markup: void 0 });
    return;
  }
  if (data.startsWith("alert_reply_")) {
    const parts = data.split("_");
    const type = parts[2];
    const fanId = parts[3];
    if (ctx.from?.id && fanId) {
      activeReplies[String(ctx.from.id)] = fanId;
    }
    await ctx.answerCallbackQuery();
    let promptStr = "";
    if (type === "voice") promptStr = "\u{1F3A4} Please record and send your Voice Note now. Our AI will auto-tag it and push it directly into your OnlyFans Vault before sending it to the fan.";
    if (type === "video") promptStr = "\u{1F4F9} Please upload your Video now. Our AI will auto-tag it and push it directly into your OnlyFans Vault before sending it to the fan.";
    if (type === "text") promptStr = "\u270D\uFE0F Please type your Text message now. (It will be automatically sent via the chat engine).";
    await ctx.reply(promptStr, replyOpt);
    await ctx.editMessageReplyMarkup({ reply_markup: void 0 });
  }
});
bot.on(["message:photo", "message:video", "message:voice"], async (ctx) => {
  try {
    const telegramId = String(ctx.from?.id);
    const telegramGroupId = String(ctx.chat?.id);
    if (!telegramId) return;
    const creator = await prisma.creator.findFirst({
      where: {
        OR: [
          { telegramId },
          { telegramGroupId }
        ]
      }
    });
    if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
      await ctx.reply("\u274C You are not registered or your OnlyFans Account is not linked.");
      return;
    }
    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
      await ctx.reply("\u274C System API Key is missing in Vercel settings.");
      return;
    }
    await ctx.reply("Media received! Scanning with AI Safety model...");
    let fileId = "";
    let fileName = "";
    let mimeType = "";
    if (ctx.message.photo) {
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
    const response = await fetch(fileLink);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safetyResult = await analyzeMediaSafety(buffer, mimeType);
    if (!safetyResult.isSafe) {
      await ctx.reply(`\u274C Upload rejected by AI Analyzer. Reason: ${safetyResult.reason || "NSFW policy violation."}`);
      return;
    }
    await ctx.reply("AI Scan Passed! Uploading to OnlyFans Vault and attaching tags...");
    const uploadResponse = await uploadToVault(
      creator.ofapiCreatorId || creator.telegramId,
      apiKey,
      buffer,
      fileName,
      safetyResult.title,
      safetyResult.description
    );
    await prisma.mediaAsset.create({
      data: {
        creatorId: creator.id,
        ofapiMediaId: uploadResponse.id || uploadResponse.prefixed_id || "vault_" + Date.now(),
        fileType: mimeType,
        originalName: fileName,
        totalRevenue: 0
      }
    });
    const targetFanId = activeReplies[telegramId];
    if (targetFanId && uploadResponse.id) {
      await sendVaultMediaToFan(targetFanId, uploadResponse.id, apiKey);
      delete activeReplies[telegramId];
      await ctx.reply(`\u2705 Direct Message Sent! The Vault media asset has successfully been forwarded to fan ID: ${targetFanId}.`);
    } else {
      const successMd = `
Upload Complete [Track ID: ${uploadResponse.id || uploadResponse.prefixed_id || "N/A"}]

Title: ${safetyResult.title}
Tags: ${safetyResult.description}

Your file is now securely stored in your Vault.
        `;
      await ctx.reply(successMd);
    }
  } catch (e) {
    console.error("Direct Upload Handler Error:", e);
    await ctx.reply("Sorry, an error occurred while processing your vault upload: " + e.message);
  }
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listChats, getChatMessages } from "@/lib/ofapi";
import { stripHtml } from "@/lib/ai-classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/debug/scoring-test
 *
 * Tests the EXACT same OFAPI calls that the scoring pipeline makes.
 * Picks one creator, calls listChats + getChatMessages, and shows:
 * 1. Raw OFAPI response shapes
 * 2. Which messages exist
 * 3. Which fall inside the scoring window
 * 4. Why scoring finds 0 messages
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // Find one creator with OFAPI credentials
  const creator = await prisma.creator.findFirst({
    where: {
      active: true,
      ofapiToken: { not: null },
      ofapiCreatorId: { not: null },
    },
    select: {
      id: true,
      name: true,
      ofapiCreatorId: true,
      ofapiToken: true,
    },
  });

  if (!creator || !creator.ofapiToken || !creator.ofapiCreatorId) {
    return NextResponse.json({ error: "No creator with OFAPI credentials found" });
  }

  results.creator = {
    name: creator.name,
    ofapiCreatorId: creator.ofapiCreatorId,
    tokenPreview: creator.ofapiToken.slice(0, 15) + "...",
    tokenLength: creator.ofapiToken.length,
    tokenIsPlaceholder: creator.ofapiToken === "linked_via_auth_module",
  };

  // Compute the scoring window (same logic as the cron)
  const now = new Date();
  const ukFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = ukFormatter.formatToParts(now);
  const ukYear = parseInt(parts.find(p => p.type === "year")!.value);
  const ukMonth = parseInt(parts.find(p => p.type === "month")!.value) - 1;
  const ukDay = parseInt(parts.find(p => p.type === "day")!.value);
  const ukHour = parseInt(parts.find(p => p.type === "hour")!.value);

  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const ukStr = now.toLocaleString("en-US", { timeZone: "Europe/London" });
  const ukOffset = new Date(ukStr).getTime() - new Date(utcStr).getTime();

  const windowEndUK = new Date(Date.UTC(ukYear, ukMonth, ukDay, ukHour, 0, 0, 0));
  const windowStartUK = new Date(Date.UTC(ukYear, ukMonth, ukDay, ukHour - 1, 0, 0, 0));
  const windowStart = new Date(windowStartUK.getTime() - ukOffset);
  const windowEnd = new Date(windowEndUK.getTime() - ukOffset);

  results.window = {
    start: windowStart.toISOString(),
    end: windowEnd.toISOString(),
    ukHour: `${ukHour - 1}:00 - ${ukHour}:00 UK`,
  };

  // Step 1: Call listChats — exact same call as scorer
  let chatData: any;
  try {
    chatData = await listChats(creator.ofapiCreatorId, creator.ofapiToken, 10, 0);
    results.listChatsRaw = {
      topLevelKeys: chatData ? Object.keys(chatData) : "null response",
      hasData: !!chatData?.data,
      dataType: chatData?.data ? (Array.isArray(chatData.data) ? "array" : typeof chatData.data) : "none",
      dataKeys: chatData?.data && !Array.isArray(chatData.data) ? Object.keys(chatData.data) : undefined,
      hasList: !!chatData?.data?.list,
      listLength: Array.isArray(chatData?.data) ? chatData.data.length : chatData?.data?.list?.length || 0,
    };
  } catch (e: any) {
    results.listChatsError = { message: e.message, status: e.status };
    return NextResponse.json(results);
  }

  // Parse chats (same logic as scorer)
  const chats = Array.isArray(chatData?.data) ? chatData.data : chatData?.data?.list || [];
  results.chatsParsed = chats.length;

  if (chats.length === 0) {
    results.verdict = "listChats returned 0 chats — OFAPI may be returning empty, tokens may be invalid, or the account has no conversations";
    return NextResponse.json(results);
  }

  // Show first 2 chat shapes — dump full fan object to understand structure
  results.sampleChats = chats.slice(0, 2).map((c: any) => ({
    chatTopId: c.id,
    withUser: c.withUser,
    fanFull: c.fan ? {
      allKeys: Object.keys(c.fan),
      id: c.fan.id,
      name: c.fan.name,
      username: c.fan.username,
      chatId: c.fan.chatId,
      userId: c.fan.userId,
    } : "fan is null/undefined",
    lastMessage: c.lastMessage ? { createdAt: c.lastMessage.createdAt } : null,
    allTopKeys: Object.keys(c),
  }));

  // Step 2: Get messages from first chat
  const firstChat = chats[0];
  // OFAPI returns fan object, not withUser — try both
  const chatId = firstChat.withUser?.id || firstChat.fan?.id || firstChat.id;
  results.resolvedChatId = { chatId, source: firstChat.withUser?.id ? "withUser" : firstChat.fan?.id ? "fan" : "chat.id" };

  let msgData: any;
  try {
    msgData = await getChatMessages(creator.ofapiCreatorId, chatId, creator.ofapiToken, 50);
    results.getMessagesRaw = {
      topLevelKeys: msgData ? Object.keys(msgData) : "null response",
      hasData: !!msgData?.data,
      dataType: msgData?.data ? (Array.isArray(msgData.data) ? "array" : typeof msgData.data) : "none",
      hasList: !!msgData?.data?.list,
      hasDirectList: !!msgData?.list,
    };
  } catch (e: any) {
    results.getMessagesError = { message: e.message };
    return NextResponse.json(results);
  }

  // Parse messages (same logic as scorer)
  const rawMsgs = msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);
  results.totalMessagesReturned = rawMsgs.length;

  if (rawMsgs.length === 0) {
    results.verdict = "getChatMessages returned 0 messages — OFAPI returns data but messages array is empty";
    return NextResponse.json(results);
  }

  // Show first 3 message shapes
  results.sampleMessages = rawMsgs.slice(0, 3).map((m: any) => ({
    id: m.id,
    createdAt: m.createdAt,
    text: (m.text || "").slice(0, 80),
    fromUser: m.fromUser ? { id: m.fromUser.id } : null,
    author: m.author ? { id: m.author.id } : null,
    topLevelKeys: Object.keys(m).slice(0, 15),
  }));

  // Sort by time
  const sorted = rawMsgs.sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Show time range of ALL messages
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  results.messageTimeRange = {
    oldest: oldest?.createdAt,
    newest: newest?.createdAt,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };

  // Filter to scoring window (same logic as scorer)
  const windowMsgs = sorted.filter((m: any) => {
    const t = new Date(m.createdAt).getTime();
    return t >= windowStart.getTime() && t <= windowEnd.getTime();
  });

  results.messagesInWindow = windowMsgs.length;

  // Also check: messages in last 24h (broader window)
  const last24h = sorted.filter((m: any) => {
    const t = new Date(m.createdAt).getTime();
    return t >= Date.now() - 24 * 60 * 60 * 1000;
  });
  results.messagesInLast24h = last24h.length;

  // Also check: messages in last 7 days
  const last7d = sorted.filter((m: any) => {
    const t = new Date(m.createdAt).getTime();
    return t >= Date.now() - 7 * 24 * 60 * 60 * 1000;
  });
  results.messagesInLast7d = last7d.length;

  // Parse some messages to check text content
  const withText = sorted.filter((m: any) => {
    const text = stripHtml(m.text || "").trim();
    return text.length >= 3;
  });
  results.messagesWithText = withText.length;

  // Diagnosis
  if (windowMsgs.length === 0 && rawMsgs.length > 0) {
    const newestTime = new Date(newest.createdAt).getTime();
    const oldestTime = new Date(oldest.createdAt).getTime();

    if (newestTime < windowStart.getTime()) {
      const hoursAgo = ((windowStart.getTime() - newestTime) / 3600000).toFixed(1);
      results.verdict = `Messages exist but ALL are OLDER than the scoring window. Newest message is ${hoursAgo}h before window start. The getChatMessages API returns old messages — it may need a time filter or the chats are stale.`;
    } else if (oldestTime > windowEnd.getTime()) {
      results.verdict = "Messages exist but ALL are NEWER than the scoring window.";
    } else {
      results.verdict = "Messages exist in the time range but none passed the exact window filter. Check createdAt format.";
    }
  } else if (windowMsgs.length > 0) {
    results.verdict = `Found ${windowMsgs.length} messages in the window — scoring SHOULD work. Something else is wrong.`;
  }

  return NextResponse.json(results);
}

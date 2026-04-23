import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listChats, getChatMessages } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/sync-messages
 * Runs every 2 min. Ingests new chat messages for active creators in rotation.
 * Picks the 8 creators most overdue for sync (oldest lastSyncAt first).
 * Stores raw messages in RawChatMessage with dedup by (creatorId, ofMessageId).
 * Uses SyncCursor to track last-seen message per chat to avoid re-processing.
 * Pass ?forceAll=true to process ALL creators (for backfill).
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const forceAll = req.nextUrl.searchParams.get("forceAll") === "true";
  const forceCreatorId = req.nextUrl.searchParams.get("creatorId");

  try {
    let creators: any[];
    if (forceCreatorId) {
      const c = await prisma.creator.findUnique({
        where: { id: forceCreatorId },
        select: { id: true, ofapiCreatorId: true, ofapiToken: true },
      });
      creators = c ? [c] : [];
    } else {
      creators = await prisma.creator.findMany({
        where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
        select: { id: true, ofapiCreatorId: true, ofapiToken: true },
      });
    }

    // Find the most recent lastSyncAt per creator from SyncCursor
    const latestSyncs = await prisma.syncCursor.groupBy({
      by: ["creatorId"],
      where: { dataType: "chat_messages" },
      _max: { lastSyncAt: true },
    });
    const syncMap = new Map(latestSyncs.map((s) => [s.creatorId, s._max.lastSyncAt]));

    // Sort creators by oldest sync first (never-synced creators come first)
    const sorted = [...creators].sort((a, b) => {
      const aSync = syncMap.get(a.id)?.getTime() ?? 0;
      const bSync = syncMap.get(b.id)?.getTime() ?? 0;
      return aSync - bSync;
    });

    const apiKey = process.env.OFAPI_API_KEY || "";
    let totalIngested = 0;
    let totalChats = 0;

    // Process 3 creators per run (rotation), or ALL if forceAll.
    // Webhooks handle real-time ingestion; this cron is a gap-filler.
    const batch = forceAll ? sorted : sorted.slice(0, 3);

    if (forceAll) {
      console.log(`[sync-messages] forceAll=true — processing all ${batch.length} creators (maxDuration=${maxDuration}s)`);
    }

    for (const creator of batch) {
      const acctId = creator.ofapiCreatorId!;
      const token = creator.ofapiToken === "linked_via_auth_module" ? apiKey : creator.ofapiToken!;

      try {
        // Get recent chats (most active first)
        const chatData = await listChats(acctId, token, 20, 0);
        const chats = Array.isArray(chatData?.data) ? chatData.data : chatData?.data?.list || [];

        for (const chat of chats) {
          const chatId = String(chat.withUser?.id || chat.fan?.id || chat.id);
          if (!chatId) continue;
          totalChats++;

          // Get cursor for this chat
          const cursor = await prisma.syncCursor.findUnique({
            where: { creatorId_dataType_chatId: { creatorId: creator.id, dataType: "chat_messages", chatId } },
          });

          // Fetch messages (newest first)
          const msgData = await getChatMessages(acctId, chatId, token, 50);
          const msgs = msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);

          if (msgs.length === 0) continue;

          // Filter to only new messages (after last cursor)
          const newMsgs = cursor?.lastSeenId
            ? msgs.filter((m: any) => String(m.id) !== cursor.lastSeenId)
            : msgs;

          if (newMsgs.length === 0) continue;

          // Store raw messages
          const rows = newMsgs.map((m: any) => ({
            ofMessageId: String(m.id),
            creatorId: creator.id,
            chatId,
            fromUserId: String(m.fromUser?.id || ""),
            isFromCreator: String(m.fromUser?.id || "") !== chatId,
            text: m.text || null,
            price: m.price || 0,
            isFree: m.isFree !== false,
            mediaCount: m.mediaCount || m.media?.length || 0,
            isLiked: m.isLiked || false,
            isTip: m.isTip || false,
            tipAmount: m.tipAmount || 0,
            raw: m,
            sentAt: new Date(m.createdAt),
          }));

          await prisma.rawChatMessage.createMany({
            data: rows,
            skipDuplicates: true,
          });

          totalIngested += rows.length;

          // Update cursor to newest message
          const newestId = String(msgs[0].id);
          await prisma.syncCursor.upsert({
            where: { creatorId_dataType_chatId: { creatorId: creator.id, dataType: "chat_messages", chatId } },
            create: { creatorId: creator.id, dataType: "chat_messages", chatId, lastSeenId: newestId },
            update: { lastSeenId: newestId, lastSyncAt: new Date() },
          });
        }
      } catch (e: any) {
        console.error(`[sync-messages] Error for ${acctId}:`, e.message);
      }
    }

    console.log(`[sync-messages] Ingested ${totalIngested} messages from ${totalChats} chats across ${batch.length} creators`);

    return NextResponse.json({
      status: "ok",
      ingested: totalIngested,
      chatsProcessed: totalChats,
      creatorsProcessed: batch.length,
      creatorsTotal: creators.length,
    });
  } catch (err: any) {
    console.error("[sync-messages] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

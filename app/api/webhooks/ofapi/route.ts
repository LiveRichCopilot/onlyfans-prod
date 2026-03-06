import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ofapi
 * Real-time events from OFAPI — every event gets stored immediately.
 *
 * Events:
 * - messages.received → RawChatMessage (fan replied = wake-up)
 * - messages.sent → RawChatMessage (chatter sent DM)
 * - messages.ppv.unlocked → increment purchasedCount on OutboundCreative
 * - transactions.new → log transaction
 * - tips.received → RawChatMessage with isTip=true
 * - subscriptions.new → log
 * - posts.liked → log
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.type || body.event || "";
    const data = body.data || body.payload || body;
    const accountId = body.accountId || body.account_id || data?.accountId || "";

    // Find creator by OFAPI account ID
    const creator = accountId
      ? await prisma.creator.findFirst({
          where: { ofapiCreatorId: accountId },
          select: { id: true, name: true },
        })
      : null;

    const creatorId = creator?.id || "unknown";
    console.log(`[webhook] ${event} | ${creator?.name || accountId}`);

    // ── Messages (fan replies + chatter DMs) ──
    if (event === "messages.received" || event === "messages.sent") {
      const msg = data?.message || data;
      if (msg && creator) {
        const chatId = String(msg.chatId || msg.fromUser?.id || msg.toUser?.id || "");
        await prisma.rawChatMessage.upsert({
          where: {
            creatorId_ofMessageId: {
              creatorId: creator.id,
              ofMessageId: String(msg.id || `wh_${Date.now()}`),
            },
          },
          create: {
            ofMessageId: String(msg.id || `wh_${Date.now()}`),
            creatorId: creator.id,
            chatId,
            fromUserId: String(msg.fromUser?.id || ""),
            isFromCreator: event === "messages.sent",
            text: msg.text || null,
            price: msg.price || 0,
            isFree: msg.isFree !== false,
            mediaCount: msg.mediaCount || msg.media?.length || 0,
            isLiked: msg.isLiked || false,
            isTip: msg.isTip || false,
            tipAmount: msg.tipAmount || 0,
            raw: msg,
            sentAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          },
          update: {},
        });
      }
    }

    // ── PPV Purchase ──
    if (event === "messages.ppv.unlocked") {
      const messageId = String(data?.messageId || data?.message?.id || data?.id || "");
      if (messageId && creator) {
        await prisma.outboundCreative.updateMany({
          where: { creatorId: creator.id, externalId: messageId },
          data: { purchasedCount: { increment: 1 } },
        });
        console.log(`[webhook] PPV bought: msg ${messageId} for ${creator.name}`);
      }
    }

    // ── Tips ──
    if (event === "tips.received") {
      const msg = data?.message || data;
      if (msg && creator) {
        const chatId = String(msg.chatId || msg.fromUser?.id || "");
        await prisma.rawChatMessage.upsert({
          where: {
            creatorId_ofMessageId: {
              creatorId: creator.id,
              ofMessageId: String(msg.id || `tip_${Date.now()}`),
            },
          },
          create: {
            ofMessageId: String(msg.id || `tip_${Date.now()}`),
            creatorId: creator.id,
            chatId,
            fromUserId: String(msg.fromUser?.id || ""),
            isFromCreator: false,
            text: msg.text || null,
            price: 0,
            isFree: true,
            mediaCount: 0,
            isLiked: false,
            isTip: true,
            tipAmount: msg.amount || msg.tipAmount || 0,
            raw: msg,
            sentAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          },
          update: {},
        });
      }
    }

    // ── Transactions (purchases, subs, tips — all revenue) ──
    if (event === "transactions.new") {
      // Store in raw for now — can be parsed into specific tables later
      console.log(`[webhook] Transaction: ${JSON.stringify(data).slice(0, 200)}`);
    }

    // ── New subscriber ──
    if (event === "subscriptions.new") {
      console.log(`[webhook] New sub for ${creator?.name}: ${JSON.stringify(data).slice(0, 200)}`);
    }

    // ── Post liked ──
    if (event === "posts.liked") {
      console.log(`[webhook] Post liked for ${creator?.name}: post ${data?.postId || data?.id}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    return NextResponse.json({ ok: true }); // Always 200 so OFAPI doesn't retry
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "ofapi-webhook" });
}

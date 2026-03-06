import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ofapi
 * Receives real-time events from OFAPI webhooks:
 * - messages.received (fan replied — wake-up)
 * - messages.sent (chatter sent DM)
 * - messages.ppv.unlocked (fan bought PPV)
 * - posts.liked (fan liked wall post)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body.type || body.event || "";
    const data = body.data || body.payload || body;
    const accountId = body.accountId || body.account_id || data?.accountId || "";

    console.log(`[ofapi-webhook] ${event} from ${accountId}`);

    // Find creator by OFAPI account ID
    const creator = accountId
      ? await prisma.creator.findFirst({
          where: { ofapiCreatorId: accountId },
          select: { id: true },
        })
      : null;

    // Store raw event for processing
    // Using RawChatMessage for message events, or log for others
    if (event === "messages.received" || event === "messages.sent") {
      const msg = data?.message || data;
      if (msg && creator) {
        const chatId = String(msg.chatId || msg.fromUser?.id || msg.toUser?.id || "");
        const isFromCreator = event === "messages.sent";

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
            isFromCreator,
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

    if (event === "messages.ppv.unlocked") {
      // Fan bought a PPV — update purchase count on the OutboundCreative
      const messageId = String(data?.messageId || data?.message?.id || "");
      if (messageId && creator) {
        await prisma.outboundCreative.updateMany({
          where: {
            creatorId: creator.id,
            externalId: messageId,
          },
          data: {
            purchasedCount: { increment: 1 },
          },
        });
        console.log(`[ofapi-webhook] PPV unlocked: message ${messageId} for ${creator.id}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[ofapi-webhook]", err.message);
    return NextResponse.json({ ok: true }); // Always 200 so OFAPI doesn't retry
  }
}

// OFAPI may send GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", service: "ofapi-webhook" });
}

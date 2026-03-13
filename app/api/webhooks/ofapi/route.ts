import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * POST /api/webhooks/ofapi
 * Real-time events from OFAPI — every event gets stored immediately.
 * Media is NOT downloaded here (caused 5xx timeouts). Instead, CDN URLs
 * + onlyfansMediaId are saved with persistStatus="pending" so the
 * Trigger.dev media-persistence task handles Supabase uploads.
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

        // Save media CDN URLs + onlyfansMediaId for persistence trigger
        const mediaItems = msg.media || [];
        if (event === "messages.sent" && mediaItems.length > 0) {
          const msgId = String(msg.id || `wh_${Date.now()}`);
          let creative = await prisma.outboundCreative.findFirst({
            where: { creatorId: creator.id, externalId: msgId },
          });
          if (!creative) {
            creative = await prisma.outboundCreative.create({
              data: {
                creatorId: creator.id,
                externalId: msgId,
                source: "direct_message",
                sentAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                isFree: msg.isFree !== false,
                priceCents: msg.price ? Math.round(msg.price * 100) : null,
                mediaCount: mediaItems.length,
                sentCount: 1,
                viewedCount: 0,
                raw: msg,
              },
            });
          }

          // Save media records with CDN URLs — trigger task persists to Supabase
          let saved = 0;
          for (const m of mediaItems) {
            const f = m?.files;
            if (!f) continue;
            const fullUrl = f?.full?.url || null;
            const previewUrl = f?.preview?.url || null;
            const thumbUrl = f?.thumb?.url || null;
            if (!fullUrl && !previewUrl && !thumbUrl) continue;

            const mediaId = m.id ? String(m.id) : `m${Date.now()}_${saved}`;
            const compositeId = `wh_${creative.id}_${mediaId}`;
            await prisma.outboundMedia.upsert({
              where: { id: compositeId },
              create: {
                id: compositeId,
                creativeId: creative.id,
                onlyfansMediaId: m.id ? String(m.id) : null,
                mediaType: m.type || "photo",
                fullUrl,
                previewUrl,
                thumbUrl,
                persistStatus: "pending",
              },
              update: { fullUrl, previewUrl, thumbUrl },
            });
            saved++;
          }
          if (saved > 0) console.log(`[webhook] Saved ${saved} media records for msg ${msgId} (pending persistence)`);
        }
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

    // ── Transactions ──
    if (event === "transactions.new") {
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
    console.error("[webhook] Error:", err?.message || err);
    return NextResponse.json({ ok: true }); // Always 200 so OFAPI doesn't retry
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "ofapi-webhook" });
}

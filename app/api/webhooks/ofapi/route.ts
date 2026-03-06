import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OFAPI_BASE = "https://app.onlyfansapi.com";
const MEDIA_BUCKET = "content-media";

async function persistMedia(accountId: string, creatorId: string, mediaItems: any[], creativeId: string) {
  const apiKey = (process.env.OFAPI_API_KEY || "").trim();
  if (!apiKey || !SUPABASE_URL || !SERVICE_ROLE_KEY) return 0;

  let saved = 0;
  for (const m of mediaItems) {
    const f = m?.files;
    if (!f) continue;
    const sourceUrl = f?.preview?.url || f?.thumb?.url || f?.full?.url;
    if (!sourceUrl) continue;
    if (m.type === "video") continue; // Skip videos — too large

    try {
      // Download from OFAPI (fresh CDN URL)
      const dlUrl = `${OFAPI_BASE}/api/${accountId}/media/download/${sourceUrl}`;
      const res = await fetch(dlUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;

      const blob = await res.arrayBuffer();
      const ext = "jpg";
      const mediaId = m.id || `m${Date.now()}_${saved}`;
      const path = `${creatorId}/${creativeId}/${mediaId}.${ext}`;

      // Upload to Supabase Storage
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`;
      const upRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": res.headers.get("content-type") || "image/jpeg",
          "x-upsert": "true",
        },
        body: blob,
      });
      if (!upRes.ok) continue;

      const permanentUrl = `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;

      // Save to OutboundMedia
      await prisma.outboundMedia.upsert({
        where: { id: `wh_${mediaId}` },
        create: {
          id: `wh_${mediaId}`,
          creativeId,
          mediaType: m.type || "photo",
          fullUrl: f?.full?.url || null,
          previewUrl: f?.preview?.url || null,
          thumbUrl: f?.thumb?.url || null,
          permanentUrl,
        },
        update: { permanentUrl },
      });
      saved++;
    } catch { /* best effort */ }
  }
  return saved;
}

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

        // Persist media to Supabase immediately (CDN URLs are fresh right now)
        const mediaItems = msg.media || [];
        if (event === "messages.sent" && mediaItems.length > 0 && accountId) {
          // Find or create OutboundCreative for this message
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
              },
            });
          }
          const saved = await persistMedia(accountId, creator.id, mediaItems, creative.id);
          if (saved > 0) console.log(`[webhook] Persisted ${saved} images for msg ${msgId}`);
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

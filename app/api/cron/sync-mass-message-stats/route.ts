import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllMassMessageStats, getAllMessageBuyers } from "@/lib/ofapi-engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

/**
 * GET /api/cron/sync-mass-message-stats
 * Runs every 15 min. For each creator:
 *   1. Fetch all mass messages for last 7 days (auto-paginated)
 *   2. Upsert per-message stats into MassMessageStat
 *   3. For messages with purchases, fetch all buyers (auto-paginated)
 *   4. Upsert buyer rows into MassMessageBuyer
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const creators = await prisma.creator.findMany({
      where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
      select: { id: true, ofapiCreatorId: true, ofapiToken: true },
    });

    const apiKey = process.env.OFAPI_API_KEY || "";
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let totalMessages = 0;
    let totalBuyers = 0;

    // Process max 5 creators per run (buyer fetches can be heavy)
    for (const creator of creators.slice(0, 5)) {
      const acctId = creator.ofapiCreatorId!;
      const token = creator.ofapiToken === "linked_via_auth_module" ? apiKey : creator.ofapiToken!;

      try {
        const messages = await getAllMassMessageStats(acctId, token, { startDate, endDate: now });

        for (const m of messages) {
          const msgId = BigInt(m.id);
          const price = typeof m.price === "string" ? parseFloat(m.price) : (m.price ?? 0);

          await prisma.massMessageStat.upsert({
            where: { creatorId_messageId: { creatorId: creator.id, messageId: msgId } },
            create: {
              creatorId: creator.id,
              messageId: msgId,
              sentAt: new Date(m.date),
              sentCount: m.sentCount || 0,
              viewedCount: m.viewedCount || 0,
              purchasedCount: m.purchasedCount || 0,
              priceCents: Math.round(price * 100),
              text: m.rawText || m.text || null,
              mediaCount: m.mediaCount || 0,
              raw: m,
            },
            update: {
              sentCount: m.sentCount || 0,
              viewedCount: m.viewedCount || 0,
              purchasedCount: m.purchasedCount || 0,
              priceCents: Math.round(price * 100),
              raw: m,
            },
          });
          totalMessages++;

          // Fetch buyers for messages with purchases
          if ((m.purchasedCount || 0) > 0) {
            try {
              const buyers = await getAllMessageBuyers(acctId, token, String(m.id));
              for (const b of buyers) {
                const buyerId = String(b.id || b.userId || b.user_id || "");
                if (!buyerId) continue;
                await prisma.massMessageBuyer.upsert({
                  where: {
                    creatorId_messageId_buyerUserId: {
                      creatorId: creator.id, messageId: msgId, buyerUserId: buyerId,
                    },
                  },
                  create: {
                    creatorId: creator.id, messageId: msgId, buyerUserId: buyerId,
                    purchasedAt: b.purchasedAt ? new Date(b.purchasedAt) : null,
                    raw: b,
                  },
                  update: {
                    purchasedAt: b.purchasedAt ? new Date(b.purchasedAt) : null,
                    raw: b,
                  },
                });
                totalBuyers++;
              }
            } catch (e: any) {
              console.error(`[sync-mass-stats] Buyer error msg ${m.id}:`, e.message);
            }
          }
        }
      } catch (e: any) {
        console.error(`[sync-mass-stats] Error for ${acctId}:`, e.message);
      }
    }

    console.log(`[sync-mass-stats] ${totalMessages} msgs, ${totalBuyers} buyers, ${Math.min(creators.length, 5)} creators`);
    return NextResponse.json({ status: "ok", messages: totalMessages, buyers: totalBuyers });
  } catch (err: any) {
    console.error("[sync-mass-stats] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

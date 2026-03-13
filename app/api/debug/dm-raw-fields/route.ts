import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/dm-raw-fields
 * Shows what fields exist in the `raw` JSON on DM OutboundCreatives
 * to find where the fan ID is stored.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get 5 DM PPVs with raw data
  const dms = await prisma.outboundCreative.findMany({
    where: {
      source: "direct_message",
      isFree: false,
      priceCents: { gt: 0 },
      raw: { not: undefined },
    },
    orderBy: { sentAt: "desc" },
    take: 5,
    select: { id: true, externalId: true, raw: true, purchasedCount: true, priceCents: true },
  });

  const results = dms.map((dm) => {
    const raw = dm.raw as Record<string, any> | null;
    return {
      id: dm.id,
      externalId: dm.externalId,
      priceCents: dm.priceCents,
      purchasedCount: dm.purchasedCount,
      rawIsNull: raw === null,
      rawKeys: raw ? Object.keys(raw) : [],
      // Show all top-level fields and their types/values
      rawFields: raw ? Object.entries(raw).map(([k, v]) => ({
        key: k,
        type: typeof v,
        value: typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 200) : v,
      })) : [],
      // Specifically look for user/fan IDs
      possibleFanIds: raw ? {
        toUserId: raw.toUserId,
        toUser: raw.toUser,
        fromUser: raw.fromUser,
        userId: raw.userId,
        user: raw.user,
        fanId: raw.fanId,
        chatId: raw.chatId,
        chat_id: raw.chat_id,
        withUser: raw.withUser,
        recipientId: raw.recipientId,
      } : null,
    };
  });

  return NextResponse.json({ count: dms.length, results });
}

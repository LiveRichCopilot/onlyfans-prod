import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/backfill-dm-raw
 * One-off: copies raw JSON from RawChatMessage → OutboundCreative
 * for DM records created by webhook without raw stored.
 * Matches on (creatorId, externalId = ofMessageId).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find DM OutboundCreatives with null raw
  const dmsMissingRaw = await prisma.outboundCreative.findMany({
    where: { source: "direct_message", raw: { equals: null } },
    select: { id: true, creatorId: true, externalId: true },
    take: 500,
  });

  if (dmsMissingRaw.length === 0) {
    return NextResponse.json({ backfilled: 0, message: "No DMs with null raw" });
  }

  let backfilled = 0;
  let notFound = 0;

  for (const dm of dmsMissingRaw) {
    // Look up the corresponding RawChatMessage (which does store raw)
    const rawMsg = await prisma.rawChatMessage.findUnique({
      where: {
        creatorId_ofMessageId: {
          creatorId: dm.creatorId,
          ofMessageId: dm.externalId,
        },
      },
      select: { raw: true },
    });

    if (rawMsg?.raw) {
      await prisma.outboundCreative.update({
        where: { id: dm.id },
        data: { raw: rawMsg.raw },
      });
      backfilled++;
    } else {
      notFound++;
    }
  }

  console.log(`[backfill-dm-raw] ${backfilled} backfilled, ${notFound} not found in RawChatMessage`);
  return NextResponse.json({ backfilled, notFound, total: dmsMissingRaw.length });
}

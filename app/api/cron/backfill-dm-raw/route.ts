import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/backfill-dm-raw
 * One-off: copies raw JSON from RawChatMessage → OutboundCreative
 * for DM records created by webhook without raw stored.
 * Matches on (creatorId, externalId = ofMessageId).
 * Idempotent — safe to re-run (only touches rows where raw IS NULL).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find DM OutboundCreatives with database NULL raw
  // Use Prisma.DbNull to distinguish from JSON null value
  const dmsMissingRaw = await prisma.outboundCreative.findMany({
    where: { source: "direct_message", raw: { equals: Prisma.DbNull } },
    select: { id: true, creatorId: true, externalId: true },
    take: 500,
  });

  if (dmsMissingRaw.length === 0) {
    return NextResponse.json({ scanned: 0, updated: 0, missingRawChatMessage: 0, done: true });
  }

  let updated = 0;
  let missingRawChatMessage = 0;
  const missingIds: string[] = [];

  for (const dm of dmsMissingRaw) {
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
      updated++;
    } else {
      missingRawChatMessage++;
      if (missingIds.length < 10) missingIds.push(dm.externalId);
    }
  }

  const scanned = dmsMissingRaw.length;
  const done = scanned < 500; // If we hit the limit, there may be more
  console.log(`[backfill-dm-raw] scanned=${scanned} updated=${updated} missing=${missingRawChatMessage} done=${done}`);
  return NextResponse.json({ scanned, updated, missingRawChatMessage, missingIds, done });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/dm-purchase-audit
 * Shows exactly why DM purchases are or aren't being counted.
 * Checks: transaction types, fan matching, price matching, time windows.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600_000);

  // 1. What transaction types exist in the DB?
  const distinctTypes = await prisma.$queryRaw`
    SELECT DISTINCT type, COUNT(*)::int as count
    FROM "Transaction"
    WHERE date > ${since}
    GROUP BY type
    ORDER BY count DESC
    LIMIT 30
  ` as any[];

  // 2. Recent DM PPVs and their enrichment status
  const dmPpvs = await prisma.outboundCreative.findMany({
    where: {
      source: "direct_message",
      isFree: false,
      priceCents: { gt: 0 },
      sentAt: { gt: since },
    },
    orderBy: { sentAt: "desc" },
    take: 30,
    select: {
      id: true, externalId: true, creatorId: true, sentAt: true,
      priceCents: true, purchasedCount: true, raw: true,
    },
  });

  // 3. For each DM PPV, check if we can find matching transactions
  const audit: any[] = [];
  for (const dm of dmPpvs) {
    const rawObj = dm.raw as Record<string, any> | null;
    const toUserId = rawObj?.toUser?.id ? String(rawObj.toUser.id) : (rawObj?.toUserId ? String(rawObj.toUserId) : null);

    let fanRecord: any = null;
    let matchingTxs: any[] = [];
    let allFanTxs: any[] = [];
    let allCreatorMsgTxs: any[] = [];

    if (toUserId) {
      fanRecord = await prisma.fan.findFirst({
        where: { ofapiFanId: toUserId },
        select: { id: true, ofapiFanId: true, name: true },
      });

      if (fanRecord) {
        const priceDollars = dm.priceCents! / 100;
        const maxWindow = new Date(Math.min(
          new Date(dm.sentAt).getTime() + 48 * 3600_000,
          now.getTime()
        ));

        // Exact match (what buyers-enrichment uses)
        matchingTxs = await prisma.transaction.findMany({
          where: {
            creatorId: dm.creatorId,
            fanId: fanRecord.id,
            type: { contains: "message" },
            amount: { gte: priceDollars - 0.02, lte: priceDollars + 0.02 },
            date: { gt: new Date(dm.sentAt), lte: maxWindow },
          },
          take: 5,
          select: { id: true, type: true, amount: true, date: true },
        });

        // ALL transactions from this fan in the window (to see what types exist)
        allFanTxs = await prisma.transaction.findMany({
          where: {
            creatorId: dm.creatorId,
            fanId: fanRecord.id,
            date: { gt: new Date(dm.sentAt), lte: maxWindow },
          },
          take: 10,
          select: { id: true, type: true, amount: true, date: true },
        });
      }
    }

    // ALL "message" type transactions for this creator in the window
    allCreatorMsgTxs = await prisma.transaction.findMany({
      where: {
        creatorId: dm.creatorId,
        type: { contains: "message" },
        amount: { gt: 0 },
        date: {
          gt: new Date(dm.sentAt),
          lte: new Date(Math.min(new Date(dm.sentAt).getTime() + 48 * 3600_000, now.getTime())),
        },
      },
      take: 10,
      select: { id: true, type: true, amount: true, date: true, fanId: true },
    });

    audit.push({
      dmId: dm.id,
      externalId: dm.externalId,
      sentAt: dm.sentAt,
      priceCents: dm.priceCents,
      priceDollars: dm.priceCents! / 100,
      currentPurchasedCount: dm.purchasedCount,
      rawHasToUserId: !!toUserId,
      toUserId,
      fanFound: !!fanRecord,
      fanId: fanRecord?.id,
      fanName: fanRecord?.name,
      exactMatchCount: matchingTxs.length,
      exactMatches: matchingTxs,
      allFanTxsInWindow: allFanTxs,
      allCreatorMsgTxs: allCreatorMsgTxs.length,
      diagnosis: !toUserId ? "NO_RAW_TOUSERID"
        : !fanRecord ? "FAN_NOT_FOUND"
        : matchingTxs.length > 0 ? "MATCH_FOUND"
        : allFanTxs.length > 0 ? "FAN_HAS_TXS_BUT_TYPE_OR_PRICE_MISMATCH"
        : "NO_TRANSACTIONS_IN_WINDOW",
    });
  }

  // 4. Summary stats
  const diagnosisCounts: Record<string, number> = {};
  for (const a of audit) {
    diagnosisCounts[a.diagnosis] = (diagnosisCounts[a.diagnosis] || 0) + 1;
  }

  return NextResponse.json({
    transactionTypes: distinctTypes,
    dmPpvCount: dmPpvs.length,
    diagnosisCounts,
    audit,
  });
}

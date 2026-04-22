import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAllTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GATE_TOKEN = "lucy-dec-backfill-x7k92q";
const CREATOR_USERNAME = "lucymochi";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k");
  if (key !== GATE_TOKEN) {
    return new NextResponse("Not found", { status: 404 });
  }

  const globalApiKey = process.env.OFAPI_API_KEY;
  if (!globalApiKey) {
    return NextResponse.json({ error: "OFAPI_API_KEY missing" }, { status: 500 });
  }

  const daysBack = Number(req.nextUrl.searchParams.get("daysBack") ?? 150);
  const maxTx = Number(req.nextUrl.searchParams.get("maxTx") ?? 50000);

  const creator = await prisma.creator.findFirst({
    where: { ofUsername: { contains: CREATOR_USERNAME, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  if (!creator.ofapiToken || creator.ofapiToken === "unlinked") {
    return NextResponse.json({ error: "Creator missing OFAPI token" }, { status: 400 });
  }

  const accountName = creator.ofapiCreatorId || creator.telegramId;
  const apiKey = creator.ofapiToken;
  const startWindow = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const started = Date.now();
  let txFetched = 0;
  let txWritten = 0;
  let decTxCount = 0;
  let decRevenue = 0;
  const errors: string[] = [];

  try {
    const transactions = await fetchAllTransactions(accountName, apiKey, startWindow, maxTx);
    txFetched = transactions.length;

    const allFanIds = [
      ...new Set(
        transactions.map((tx: any) => tx.user?.id?.toString()).filter(Boolean),
      ),
    ];

    const existingFans = await prisma.fan.findMany({
      where: { ofapiFanId: { in: allFanIds } },
      select: { id: true, ofapiFanId: true },
    });
    const fanMap = new Map(existingFans.map((f) => [f.ofapiFanId, f.id]));

    const missingFanIds = allFanIds.filter((id) => !fanMap.has(id));
    if (missingFanIds.length > 0) {
      const missingFanData = missingFanIds.map((fanId) => {
        const tx = transactions.find((t: any) => t.user?.id?.toString() === fanId);
        return {
          ofapiFanId: fanId,
          creatorId: creator.id,
          name: tx?.user?.name || tx?.user?.displayName || null,
          username: tx?.user?.username || null,
          lifetimeSpend: 0,
        };
      });
      await prisma.fan.createMany({ data: missingFanData, skipDuplicates: true });
      const newlyCreated = await prisma.fan.findMany({
        where: { ofapiFanId: { in: missingFanIds } },
        select: { id: true, ofapiFanId: true },
      });
      for (const f of newlyCreated) fanMap.set(f.ofapiFanId, f.id);
    }

    const txRecords: any[] = [];
    for (const tx of transactions) {
      const fanOfId = tx.user?.id?.toString();
      if (!fanOfId) continue;
      const fanId = fanMap.get(fanOfId);
      if (!fanId) continue;
      txRecords.push({
        ofapiTxId: String(tx.id),
        fanId,
        creatorId: creator.id,
        amount: Number(tx.amount ?? 0),
        type: tx.type || null,
        date: new Date(tx.createdAt),
      });
    }

    const batchSize = 1000;
    for (let i = 0; i < txRecords.length; i += batchSize) {
      const batch = txRecords.slice(i, i + batchSize);
      const result = await prisma.transaction.createMany({
        data: batch,
        skipDuplicates: true,
      });
      txWritten += result.count;
    }

    const decStart = new Date("2025-12-01T00:00:00Z");
    const decEnd = new Date("2026-01-01T00:00:00Z");
    const decAgg = await prisma.transaction.aggregate({
      where: {
        creatorId: creator.id,
        date: { gte: decStart, lt: decEnd },
      },
      _count: { _all: true },
      _sum: { amount: true },
    });
    decTxCount = decAgg._count?._all ?? 0;
    decRevenue = Number(decAgg._sum?.amount ?? 0);
  } catch (e: any) {
    errors.push(e?.message || String(e));
  }

  return NextResponse.json({
    ok: errors.length === 0,
    creatorId: creator.id,
    creatorName: creator.name,
    daysBack,
    maxTx,
    txFetched,
    txWritten,
    december: { count: decTxCount, revenue: Math.round(decRevenue) },
    elapsedMs: Date.now() - started,
    errors,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GATE_TOKEN = "lucy-dec-backfill-x7k92q";
const CREATOR_USERNAME = "lucymochi";
const WALL_CLOCK_BUDGET_MS = 55_000;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k");
  if (key !== GATE_TOKEN) {
    return new NextResponse("Not found", { status: 404 });
  }

  const globalApiKey = process.env.OFAPI_API_KEY;
  if (!globalApiKey) {
    return NextResponse.json({ error: "OFAPI_API_KEY missing" }, { status: 500 });
  }

  const startDateParam = req.nextUrl.searchParams.get("startDate") ?? "2025-12-01";
  const startDate = new Date(startDateParam + "T00:00:00Z");

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
  const started = Date.now();

  const errors: string[] = [];
  let pages = 0;
  let fetched = 0;
  let written = 0;
  let oldestDateSeen: Date | null = null;
  let reachedTarget = false;
  let timedOut = false;
  let marker: string | undefined =
    req.nextUrl.searchParams.get("marker") ?? undefined;

  try {
    while (true) {
      if (Date.now() - started > WALL_CLOCK_BUDGET_MS) {
        timedOut = true;
        break;
      }

      const res: any = await getTransactions(accountName, apiKey, undefined, 100, marker).catch(
        (e) => {
          errors.push(`fetch page err: ${e?.message || e}`);
          return null;
        },
      );
      if (!res) break;

      const txs: any[] = res.data?.list || res.list || res.transactions || [];
      if (!txs.length) break;

      pages++;
      fetched += txs.length;

      const fanIds = [
        ...new Set(txs.map((tx) => tx.user?.id?.toString()).filter(Boolean)),
      ];
      const existing = await prisma.fan.findMany({
        where: { ofapiFanId: { in: fanIds } },
        select: { id: true, ofapiFanId: true },
      });
      const fanMap = new Map(existing.map((f) => [f.ofapiFanId, f.id]));
      const missing = fanIds.filter((id) => !fanMap.has(id));
      if (missing.length) {
        const rows = missing.map((fanOfId) => {
          const tx = txs.find((t) => t.user?.id?.toString() === fanOfId);
          return {
            ofapiFanId: fanOfId,
            creatorId: creator.id,
            name: tx?.user?.name || tx?.user?.displayName || null,
            username: tx?.user?.username || null,
            lifetimeSpend: 0,
          };
        });
        await prisma.fan.createMany({ data: rows, skipDuplicates: true });
        const fresh = await prisma.fan.findMany({
          where: { ofapiFanId: { in: missing } },
          select: { id: true, ofapiFanId: true },
        });
        for (const f of fresh) fanMap.set(f.ofapiFanId, f.id);
      }

      const records = txs
        .map((tx) => {
          const fanOfId = tx.user?.id?.toString();
          if (!fanOfId) return null;
          const fanId = fanMap.get(fanOfId);
          if (!fanId) return null;
          return {
            ofapiTxId: String(tx.id),
            fanId,
            creatorId: creator.id,
            amount: Number(tx.amount ?? 0),
            type: tx.type || null,
            date: new Date(tx.createdAt),
          };
        })
        .filter(Boolean) as any[];

      if (records.length) {
        const writeRes = await prisma.transaction.createMany({
          data: records,
          skipDuplicates: true,
        });
        written += writeRes.count;
      }

      const oldestInBatch = new Date(txs[txs.length - 1].createdAt);
      if (!oldestDateSeen || oldestInBatch < oldestDateSeen) oldestDateSeen = oldestInBatch;
      if (oldestInBatch < startDate) {
        reachedTarget = true;
        break;
      }

      const nextMarker = res.data?.nextMarker ?? res.nextMarker;
      if (!nextMarker) break;
      marker = nextMarker;
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
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
  const decCount = decAgg._count?._all ?? 0;
  const decRevenue = Number(decAgg._sum?.amount ?? 0);

  const totalTx = await prisma.transaction.count({ where: { creatorId: creator.id } });
  const oldestTx = await prisma.transaction.findFirst({
    where: { creatorId: creator.id },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  return NextResponse.json({
    ok: errors.length === 0,
    pages,
    fetched,
    written,
    oldestDateSeenInThisRun: oldestDateSeen?.toISOString() ?? null,
    targetStartDate: startDate.toISOString(),
    reachedTarget,
    timedOut,
    nextMarker: timedOut ? marker : null,
    elapsedMs: Date.now() - started,
    db: {
      totalTx,
      oldestDateInDb: oldestTx?.date?.toISOString() ?? null,
      december: { count: decCount, revenue: Math.round(decRevenue) },
    },
    errors,
  });
}

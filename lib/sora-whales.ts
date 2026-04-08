/**
 * Sora cross-creator whale detection.
 *
 * Finds fans who have spent across multiple creators in the agency,
 * ranked by total spend. For the currently selected model, also shows
 * how much each whale has spent on THIS model vs OTHER models — so
 * Sora can spot hidden whales: someone who spent $10k on Corrie but
 * $0 on Kylie is a recovery opportunity.
 *
 * The Fan table is globally deduped (one row per ofapiFanId), so we
 * join via Transaction → Fan to get the OF user ID and pivot by
 * creatorId in JavaScript.
 */

import { prisma } from "@/lib/prisma";

export type Whale = {
  ofapiFanId: string;
  username: string | null;
  totalSpend: number;
  thisModelSpend: number;
  otherSpend: number;
  creatorCount: number;
  creators: Array<{ name: string; spend: number; isThisModel: boolean }>;
  status: "hidden_whale" | "engaged_whale" | "low_engagement";
};

export async function getCrossCreatorWhales(args: {
  modelId: string;
  minTotalSpend?: number;
  limit?: number;
}): Promise<Whale[]> {
  const minSpend = args.minTotalSpend ?? 200;
  const limit = args.limit ?? 20;

  // Pull every fan that has spent across 2+ creators, with per-creator totals.
  // Raw SQL because Prisma's groupBy doesn't support a triple pivot.
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      ofapiFanId: string;
      username: string | null;
      creatorId: string;
      creatorName: string | null;
      spend: number;
    }>
  >(`
    SELECT
      f."ofapiFanId" AS "ofapiFanId",
      f.username AS "username",
      t."creatorId" AS "creatorId",
      c.name AS "creatorName",
      SUM(t.amount)::float AS "spend"
    FROM "Transaction" t
    JOIN "Fan" f ON f.id = t."fanId"
    JOIN "Creator" c ON c.id = t."creatorId"
    WHERE f."ofapiFanId" IS NOT NULL
    GROUP BY f."ofapiFanId", f.username, t."creatorId", c.name
    HAVING SUM(t.amount) > 0
  `);

  // Pivot in JavaScript: ofapiFanId → { totalSpend, creators[] }
  const byFan = new Map<
    string,
    {
      ofapiFanId: string;
      username: string | null;
      totals: Map<string, { name: string; spend: number }>;
    }
  >();

  for (const r of rows) {
    if (!r.ofapiFanId) continue;
    const cur = byFan.get(r.ofapiFanId) || {
      ofapiFanId: r.ofapiFanId,
      username: r.username,
      totals: new Map<string, { name: string; spend: number }>(),
    };
    cur.totals.set(r.creatorId, {
      name: r.creatorName || "Unknown",
      spend: Math.round(Number(r.spend) * 100) / 100,
    });
    byFan.set(r.ofapiFanId, cur);
  }

  const whales: Whale[] = [];
  for (const fan of byFan.values()) {
    const totalSpend = [...fan.totals.values()].reduce((s, c) => s + c.spend, 0);
    if (totalSpend < minSpend) continue;
    if (fan.totals.size < 2) continue;

    const thisModel = fan.totals.get(args.modelId);
    const thisModelSpend = thisModel?.spend || 0;
    const otherSpend = Math.round((totalSpend - thisModelSpend) * 100) / 100;

    let status: Whale["status"];
    if (thisModelSpend === 0 && otherSpend >= 500) status = "hidden_whale";
    else if (thisModelSpend > 0 && otherSpend > thisModelSpend * 3) status = "low_engagement";
    else status = "engaged_whale";

    const creators = [...fan.totals.entries()]
      .map(([cid, c]) => ({
        name: c.name,
        spend: c.spend,
        isThisModel: cid === args.modelId,
      }))
      .sort((a, b) => b.spend - a.spend);

    whales.push({
      ofapiFanId: fan.ofapiFanId,
      username: fan.username,
      totalSpend: Math.round(totalSpend * 100) / 100,
      thisModelSpend,
      otherSpend,
      creatorCount: fan.totals.size,
      creators,
      status,
    });
  }

  // Sort: hidden whales first, then by total spend
  whales.sort((a, b) => {
    if (a.status === "hidden_whale" && b.status !== "hidden_whale") return -1;
    if (b.status === "hidden_whale" && a.status !== "hidden_whale") return 1;
    return b.totalSpend - a.totalSpend;
  });

  return whales.slice(0, limit);
}

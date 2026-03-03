import { prisma } from "@/lib/prisma";

/** Transaction from DB — synced by cron every 5 min. Source of truth for revenue. */
export type TransactionRow = {
  id: string;
  amount: number;
  type: string;
  date: Date;
  creatorId: string;
  fanId: string;
  category: TxCategory;
};

/** Normalized categories from raw OFAPI type strings */
export type TxCategory = "message" | "tip" | "post" | "subscription" | "stream" | "other";

/** Map raw type string (stored by sync cron) to a normalized category */
export function categorizeType(rawType: string): TxCategory {
  const lower = rawType.toLowerCase().trim();
  if (lower === "message" || lower.includes("chat_message")) return "message";
  if (lower === "tip" || lower === "tips") return "tip";
  if (lower === "post") return "post";
  if (lower.includes("subscription") || lower.includes("subscribe")) return "subscription";
  if (lower === "stream") return "stream";
  return "other";
}

/** Categories we attribute to chatters (per Sales Settings) */
const ATTRIBUTED: Set<TxCategory> = new Set(["message", "tip", "post"]);

export function isAttributable(category: TxCategory): boolean {
  return ATTRIBUTED.has(category);
}

/** Diagnostic info returned alongside data */
export type FetchDiagnostics = {
  allTxInPeriod: { count: number; sum: number };
  nullCreatorId: { count: number; sum: number };
  filtered: { count: number; sum: number };
  creatorsActive: number;
  creatorsWithTx: number;
  perCreator: Record<string, { name: string; count: number; sum: number }>;
  rawTypeValues: Record<string, number>;
  byCategory: Record<string, { count: number; sum: number; attributed: boolean }>;
};

export type FetchResult = {
  transactions: TransactionRow[];
  creators: { id: string; name: string | null }[];
  diagnostics: FetchDiagnostics;
};

/** Fetch all transaction data from DB — no caps, no pagination, just SQL */
export async function fetchTransactionData(
  startDate: Date,
  endDate: Date,
  creatorId: string | null,
): Promise<FetchResult> {
  // Get ALL creators (not just active) to avoid missing transactions
  const creatorWhere: Record<string, unknown> = {};
  if (creatorId) creatorWhere.id = creatorId;

  const creators = await prisma.creator.findMany({
    where: creatorWhere,
    select: { id: true, name: true },
  });

  const creatorIds = creators.map(c => c.id);
  const dateFilter = { gte: startDate, lte: endDate };

  // 1. Total universe: ALL transactions in period (no creator filter)
  const allAgg = await prisma.transaction.aggregate({
    _count: true,
    _sum: { amount: true },
    where: { date: dateFilter, amount: { gt: 0 } },
  });

  // 2. Null creatorId transactions
  const nullAgg = await prisma.transaction.aggregate({
    _count: true,
    _sum: { amount: true },
    where: { date: dateFilter, amount: { gt: 0 }, creatorId: null },
  });

  // 3. Filtered transactions (matching our creators)
  const txWhere: Record<string, unknown> = {
    date: dateFilter,
    amount: { gt: 0 },
  };
  if (creatorIds.length > 0) {
    txWhere.creatorId = { in: creatorIds };
  }

  const rawTx = await prisma.transaction.findMany({
    where: txWhere,
    select: {
      id: true,
      amount: true,
      type: true,
      date: true,
      creatorId: true,
      fanId: true,
    },
    orderBy: { date: "asc" },
  });

  const transactions: TransactionRow[] = rawTx
    .filter(tx => tx.creatorId)
    .map(tx => {
      const rawType = tx.type || "unknown";
      return {
        id: tx.id,
        amount: tx.amount,
        type: rawType,
        date: tx.date,
        creatorId: tx.creatorId!,
        fanId: tx.fanId,
        category: categorizeType(rawType),
      };
    });

  // Build diagnostics
  const perCreator: Record<string, { name: string; count: number; sum: number }> = {};
  const rawTypeValues: Record<string, number> = {};
  const byCategory: Record<string, { count: number; sum: number; attributed: boolean }> = {};

  for (const tx of transactions) {
    // Per creator
    if (!perCreator[tx.creatorId]) {
      const name = creators.find(c => c.id === tx.creatorId)?.name || tx.creatorId;
      perCreator[tx.creatorId] = { name, count: 0, sum: 0 };
    }
    perCreator[tx.creatorId].count += 1;
    perCreator[tx.creatorId].sum += tx.amount;

    // Raw type strings
    rawTypeValues[tx.type] = (rawTypeValues[tx.type] || 0) + 1;

    // By category
    if (!byCategory[tx.category]) {
      byCategory[tx.category] = { count: 0, sum: 0, attributed: isAttributable(tx.category) };
    }
    byCategory[tx.category].count += 1;
    byCategory[tx.category].sum += tx.amount;
  }

  const filteredSum = transactions.reduce((s, t) => s + t.amount, 0);

  const diagnostics: FetchDiagnostics = {
    allTxInPeriod: { count: allAgg._count, sum: allAgg._sum.amount || 0 },
    nullCreatorId: { count: nullAgg._count, sum: nullAgg._sum.amount || 0 },
    filtered: { count: transactions.length, sum: filteredSum },
    creatorsActive: creators.length,
    creatorsWithTx: Object.keys(perCreator).length,
    perCreator,
    rawTypeValues,
    byCategory,
  };

  console.log(`[chatter-perf] ===== DIAGNOSTIC =====`);
  console.log(`[chatter-perf] ALL tx in DB: ${diagnostics.allTxInPeriod.count}, $${diagnostics.allTxInPeriod.sum.toFixed(2)}`);
  console.log(`[chatter-perf] NULL creatorId: ${diagnostics.nullCreatorId.count}, $${diagnostics.nullCreatorId.sum.toFixed(2)}`);
  console.log(`[chatter-perf] Filtered: ${diagnostics.filtered.count} tx, $${diagnostics.filtered.sum.toFixed(2)}`);
  console.log(`[chatter-perf] Creators: ${diagnostics.creatorsActive} total, ${diagnostics.creatorsWithTx} with tx`);
  console.log(`[chatter-perf] Raw types: ${JSON.stringify(rawTypeValues)}`);
  console.log(`[chatter-perf] ===== END =====`);

  return { transactions, creators, diagnostics };
}


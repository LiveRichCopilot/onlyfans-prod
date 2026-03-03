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

export type FetchResult = {
  transactions: TransactionRow[];
  creators: { id: string; name: string | null }[];
};

/** Fetch all transaction data from DB — no caps, no pagination, just SQL */
export async function fetchTransactionData(
  startDate: Date,
  endDate: Date,
  creatorId: string | null,
): Promise<FetchResult> {
  // Get active creators — don't require OFAPI tokens since revenue is from DB
  const creatorWhere: Record<string, unknown> = { active: true };
  if (creatorId) creatorWhere.id = creatorId;

  const creators = await prisma.creator.findMany({
    where: creatorWhere,
    select: { id: true, name: true },
  });

  const creatorIds = creators.map(c => c.id);
  if (creatorIds.length === 0) {
    console.log("[chatter-perf] No active creators found");
    return { transactions: [], creators: [] };
  }

  // ALL transactions in date range — no caps, no pagination
  // amount > 0 excludes refunds/chargebacks (stored as negative by sync cron)
  const rawTx = await prisma.transaction.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      creatorId: { in: creatorIds },
      amount: { gt: 0 },
    },
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

  const transactions: TransactionRow[] = rawTx.map(tx => {
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

  // Diagnostics — breakdown by category
  const byCategory = new Map<TxCategory, { count: number; total: number }>();
  for (const tx of transactions) {
    const entry = byCategory.get(tx.category) || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += tx.amount;
    byCategory.set(tx.category, entry);
  }

  const totalAttr = transactions.filter(t => isAttributable(t.category));
  console.log(`[chatter-perf] ${transactions.length} total tx, ${totalAttr.length} attributable, ${creators.length} creators`);
  for (const [cat, info] of byCategory) {
    const tag = isAttributable(cat) ? "ATTR" : "skip";
    console.log(`[chatter-perf]   ${cat}: ${info.count} tx, $${info.total.toFixed(2)} [${tag}]`);
  }

  return { transactions, creators };
}

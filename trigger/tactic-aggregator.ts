/**
 * Tactic Aggregator Task
 *
 * Computes per-tactic performance stats from WinningSnippet data.
 * Also samples non-converting conversations for comparison (negative sampling).
 *
 * Runs: hourly for tactic stats, daily for negative sampling
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const tacticAggregatorTask = task({
  id: "tactic-aggregator",
  retry: { maxAttempts: 2 },
  run: async (payload: {
    period?: "daily" | "weekly" | "monthly";
    creatorId?: string;
  }) => {
    const period = payload.period || "daily";
    const now = new Date();

    // Calculate period start
    let periodStart: Date;
    if (period === "daily") {
      periodStart = new Date(now);
      periodStart.setUTCHours(0, 0, 0, 0);
    } else if (period === "weekly") {
      periodStart = new Date(now);
      periodStart.setUTCDate(periodStart.getUTCDate() - periodStart.getUTCDay());
      periodStart.setUTCHours(0, 0, 0, 0);
    } else {
      periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    }

    // Get all snippets in this period
    const whereClause: any = {
      createdAt: { gte: periodStart },
    };
    if (payload.creatorId) {
      whereClause.creatorId = payload.creatorId;
    }

    const snippets = await prisma.winningSnippet.findMany({
      where: whereClause,
      select: {
        tacticTag: true,
        creatorId: true,
        chatterEmail: true,
        saleAmount: true,
        confidence: true,
      },
    });

    if (snippets.length === 0) {
      return { updated: 0, message: "No snippets to aggregate" };
    }

    // Group by tacticTag + creatorId + chatterEmail
    type AggKey = string;
    type AggData = {
      tacticTag: string;
      creatorId: string;
      chatterEmail: string | null;
      count: number;
      totalRevenue: number;
      totalConfidence: number;
    };

    const agg = new Map<AggKey, AggData>();

    for (const s of snippets) {
      // Per-chatter aggregate
      const key = `${s.tacticTag}|${s.creatorId}|${s.chatterEmail || "ALL"}`;
      const existing = agg.get(key);
      if (existing) {
        existing.count++;
        existing.totalRevenue += s.saleAmount;
        existing.totalConfidence += s.confidence;
      } else {
        agg.set(key, {
          tacticTag: s.tacticTag,
          creatorId: s.creatorId,
          chatterEmail: s.chatterEmail,
          count: 1,
          totalRevenue: s.saleAmount,
          totalConfidence: s.confidence,
        });
      }

      // Also aggregate across all chatters for this creator+tactic
      const allKey = `${s.tacticTag}|${s.creatorId}|ALL`;
      if (allKey !== key) {
        const allExisting = agg.get(allKey);
        if (allExisting) {
          allExisting.count++;
          allExisting.totalRevenue += s.saleAmount;
          allExisting.totalConfidence += s.confidence;
        } else {
          agg.set(allKey, {
            tacticTag: s.tacticTag,
            creatorId: s.creatorId,
            chatterEmail: null,
            count: 1,
            totalRevenue: s.saleAmount,
            totalConfidence: s.confidence,
          });
        }
      }
    }

    // Estimate conversion rate by comparing snippet count to total messages
    // For now, use confidence as a proxy for conversion rate
    let updated = 0;

    for (const data of agg.values()) {
      const avgConfidence = data.totalConfidence / data.count;
      const avgRevenue = data.totalRevenue / data.count;

      await prisma.tacticPerformance.upsert({
        where: {
          tacticTag_creatorId_chatterEmail_period_periodStart: {
            tacticTag: data.tacticTag,
            creatorId: data.creatorId,
            chatterEmail: data.chatterEmail,
            period,
            periodStart,
          },
        },
        create: {
          tacticTag: data.tacticTag,
          creatorId: data.creatorId,
          chatterEmail: data.chatterEmail,
          useCount: data.count,
          conversionRate: avgConfidence,
          avgRevenue,
          totalRevenue: data.totalRevenue,
          period,
          periodStart,
        },
        update: {
          useCount: data.count,
          conversionRate: avgConfidence,
          avgRevenue,
          totalRevenue: data.totalRevenue,
        },
      });
      updated++;
    }

    return {
      updated,
      snippetsAnalyzed: snippets.length,
      uniqueTactics: new Set(snippets.map((s) => s.tacticTag)).size,
      period,
      periodStart: periodStart.toISOString(),
      message: `Updated ${updated} TacticPerformance rows from ${snippets.length} snippets`,
    };
  },
});

// Scheduled: hourly aggregation
export const tacticAggregatorSchedule = schedules.task({
  id: "tactic-aggregator-scheduled",
  run: async () => {
    const result = await tacticAggregatorTask.triggerAndWait({
      period: "daily",
    });
    if (result.ok) {
      console.log("[Tactic Aggregator Hourly]", result.output);
    }
  },
});

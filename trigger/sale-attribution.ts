/**
 * Sale Attribution Task
 *
 * For each unprocessed Transaction, finds the preceding chat messages
 * and writes a SaleContext row with the full conversation window.
 *
 * Pure DB work — no AI calls. Proves the pipeline end-to-end.
 *
 * Runs: every 15 min via schedule, or triggered manually
 */
import { task, schedules } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WINDOW_MINUTES = 30; // Pull messages from 30 min before sale
const BATCH_SIZE = 50; // Process 50 transactions per run

export const saleAttributionTask = task({
  id: "sale-attribution",
  retry: { maxAttempts: 3 },
  run: async (payload: { creatorId?: string; limit?: number }) => {
    const limit = payload.limit || BATCH_SIZE;

    // Find transactions that don't have a SaleContext yet
    const existingContextTxIds = await prisma.saleContext.findMany({
      select: { transactionId: true },
    });
    const processedIds = new Set(existingContextTxIds.map((sc) => sc.transactionId));

    const whereClause: any = {
      type: { in: ["tip", "message", "post", "stream"] }, // Revenue-generating types
      amount: { gt: 0 },
    };
    if (payload.creatorId) {
      whereClause.creatorId = payload.creatorId;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      take: limit * 2, // Fetch extra to filter out already-processed
      include: {
        fan: { select: { id: true, ofapiFanId: true, creatorId: true } },
      },
    });

    // Filter to unprocessed only
    const unprocessed = transactions
      .filter((tx) => !processedIds.has(tx.id))
      .slice(0, limit);

    if (unprocessed.length === 0) {
      return { processed: 0, message: "No new transactions to attribute" };
    }

    let created = 0;
    let skipped = 0;

    for (const tx of unprocessed) {
      try {
        const creatorId = tx.creatorId || tx.fan.creatorId;
        if (!creatorId) {
          skipped++;
          continue;
        }

        const fanOfId = tx.fan.ofapiFanId;
        const saleTime = tx.date;
        const windowStart = new Date(saleTime.getTime() - WINDOW_MINUTES * 60 * 1000);

        // Find the chatId for this fan+creator combo
        // Look for any message from this fan's OF ID in this creator's chats
        const chatMessage = await prisma.rawChatMessage.findFirst({
          where: {
            creatorId,
            fromUserId: fanOfId,
          },
          select: { chatId: true },
          orderBy: { sentAt: "desc" },
        });

        if (!chatMessage) {
          // Fan has no chat messages — can't attribute
          skipped++;
          continue;
        }

        const chatId = chatMessage.chatId;

        // Pull messages in the window before the sale
        const contextMessages = await prisma.rawChatMessage.findMany({
          where: {
            creatorId,
            chatId,
            sentAt: { gte: windowStart, lte: saleTime },
          },
          orderBy: { sentAt: "asc" },
          take: 30, // Cap at 30 messages
          select: {
            text: true,
            isFromCreator: true,
            sentAt: true,
            price: true,
            isTip: true,
            tipAmount: true,
          },
        });

        // Create the SaleContext
        await prisma.saleContext.create({
          data: {
            transactionId: tx.id,
            creatorId,
            fanId: tx.fanId,
            chatId,
            saleType: tx.type || "unknown",
            saleAmount: tx.amount,
            saleTimestamp: saleTime,
            contextMessages: contextMessages.map((m) => ({
              text: m.text || "",
              isFromCreator: m.isFromCreator,
              sentAt: m.sentAt.toISOString(),
              price: m.price,
              isTip: m.isTip,
              tipAmount: m.tipAmount,
            })),
            windowMinutes: WINDOW_MINUTES,
            processed: false,
          },
        });

        created++;
      } catch (e: any) {
        // Skip duplicates (unique constraint on transactionId)
        if (e.code === "P2002") {
          skipped++;
          continue;
        }
        console.error(`[Sale Attribution] Error processing tx ${tx.id}:`, e.message);
        skipped++;
      }
    }

    return {
      processed: created,
      skipped,
      total: unprocessed.length,
      message: `Created ${created} SaleContext rows, skipped ${skipped}`,
    };
  },
});

// Scheduled: every 15 minutes
export const saleAttributionSchedule = schedules.task({
  id: "sale-attribution-scheduled",
  run: async (payload) => {
    const result = await saleAttributionTask.triggerAndWait({});
    if (result.ok) {
      console.log("[Sale Attribution Scheduled]", result.output);
    }
  },
});

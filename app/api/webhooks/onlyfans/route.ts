import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { bot } from "@/lib/telegram";

const WEBHOOK_SECRET = process.env.OFAPI_WEBHOOK_SECRET || "my_secure_dev_secret_123";

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get("x-onlyfansapi-signature");

        if (!signature) {
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }

        const expectedSignature = crypto
            .createHmac("sha256", WEBHOOK_SECRET)
            .update(rawBody)
            .digest("hex");

        if (signature !== expectedSignature) {
            console.warn(`Webhook signature mismatch. Expected: ${expectedSignature}, Got: ${signature}`);
        }

        const payload = JSON.parse(rawBody);
        console.log("Received Webhook Event:", payload.event);

        // Handle purchase events — update Fan + insights + send Telegram alert
        const purchaseEvents = ["subscriptions.new", "messages.ppv.unlocked", "tips.received", "transactions.new"];
        if (purchaseEvents.includes(payload.event)) {
            await handlePurchaseEvent(payload);
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Webhook processing error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

async function handlePurchaseEvent(payload: any) {
    const accountId = payload.account_id || payload.data?.creator_id;
    const fanId = payload.data?.user?.id || payload.data?.buyer?.id || payload.data?.sender?.id;
    const fanName = payload.data?.user?.name || payload.data?.buyer?.name || payload.data?.sender?.name;
    const fanUsername = payload.data?.user?.username || payload.data?.buyer?.username || payload.data?.sender?.username;
    const amount = Number(payload.data?.price || payload.data?.amount || 0);
    const eventTime = payload.data?.created_at || payload.data?.createdAt || new Date().toISOString();

    // Map event type to purchase type
    let purchaseType = "unknown";
    if (payload.event === "tips.received") purchaseType = "tip";
    else if (payload.event === "messages.ppv.unlocked") purchaseType = "message";
    else if (payload.event === "subscriptions.new") purchaseType = "subscription";
    else if (payload.event === "transactions.new") purchaseType = payload.data?.type || "transaction";

    if (!accountId) return;

    const creator = await prisma.creator.findFirst({
        where: { ofapiCreatorId: String(accountId) },
    });
    if (!creator) return;

    // --- 1. Upsert Fan record with purchase data ---
    let fan: any = null;
    if (fanId) {
        try {
            const purchaseDate = new Date(eventTime);
            fan = await prisma.fan.upsert({
                where: { ofapiFanId: String(fanId) },
                update: {
                    lastPurchaseAt: purchaseDate,
                    lastPurchaseType: purchaseType,
                    lastPurchaseAmount: amount,
                    name: fanName || undefined,
                    username: fanUsername || undefined,
                    // Only increment spend from transactions.new to avoid double-counting
                    ...(payload.event === "transactions.new" ? { lifetimeSpend: { increment: amount } } : {}),
                    lastMessageAt: new Date(),
                    updatedAt: new Date(),
                },
                create: {
                    ofapiFanId: String(fanId),
                    creatorId: creator.id,
                    name: fanName || null,
                    username: fanUsername || null,
                    lifetimeSpend: amount,
                    lastPurchaseAt: purchaseDate,
                    lastPurchaseType: purchaseType,
                    lastPurchaseAmount: amount,
                    stage: "warming",
                    firstPurchaseAt: purchaseDate,
                    firstContactAt: purchaseDate,
                },
            });
            console.log(`Fan ${fanId} (${fanName}) updated: ${purchaseType} $${amount}`);
        } catch (dbErr: any) {
            console.error("Failed to update Fan in DB:", dbErr.message);
        }
    }

    // --- 2. Create Transaction record ONLY from transactions.new (source of truth for money) ---
    // Other events (tips.received, messages.ppv.unlocked, subscriptions.new) are treated as
    // "signals" for fan intelligence only — they DON'T create Transaction rows to avoid double-counting.
    if (fan && payload.event === "transactions.new") {
        const txId = payload.data?.id || payload.data?.transaction_id;
        if (!txId) {
            console.warn("transactions.new missing stable ID — skipping Transaction row");
        } else {
            try {
                await prisma.transaction.create({
                    data: {
                        ofapiTxId: String(txId),
                        fanId: fan.id,
                        creatorId: creator.id,
                        amount,
                        type: purchaseType,
                        date: new Date(eventTime),
                    },
                });
            } catch {
                // Skip dupes silently (unique constraint on ofapiTxId)
            }
        }
    }

    // --- 3. Auto-update fan insights based on purchase patterns ---
    if (fan) {
        try {
            const isTransactionEvent = payload.event === "transactions.new";
            await updateFanInsights(fan, amount, purchaseType, isTransactionEvent);
        } catch (e: any) {
            console.error("Failed to update fan insights:", e.message);
        }
    }

    // --- 4. Log lifecycle event ---
    if (fan) {
        try {
            await prisma.fanLifecycleEvent.create({
                data: {
                    fanId: fan.id,
                    type: "purchase",
                    metadata: {
                        event: payload.event,
                        amount,
                        purchaseType,
                        source: "webhook",
                    },
                },
            });
        } catch {
            // Non-critical — skip
        }
    }

    // --- 5. Telegram alert ---
    if (creator.telegramGroupId) {
        await sendTelegramAlert(creator, payload.event, fanName, amount, purchaseType);
    }
}

/**
 * Auto-update fan insights after each purchase:
 * - Buyer type detection (tipper vs ppv_buyer vs subscriber_only)
 * - Stage progression (new → warming → active_buyer)
 * - Price range detection
 * - Average order value
 * - Intent score bump (just bought = high intent)
 */
async function updateFanInsights(fan: any, amount: number, purchaseType: string, isTransactionEvent: boolean) {
    const updates: Record<string, any> = {};

    // --- Buyer type detection ---
    // Count transactions by type in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTx = await prisma.transaction.groupBy({
        by: ["type"],
        where: { fanId: fan.id, date: { gte: thirtyDaysAgo } },
        _count: { type: true },
    });

    const txCounts: Record<string, number> = {};
    recentTx.forEach(r => { txCounts[r.type || "unknown"] = r._count.type; });

    const tipCount = txCounts["tip"] || 0;
    const msgCount = txCounts["message"] || 0;
    const subCount = txCounts["subscription"] || 0;
    const totalRecentTx = Object.values(txCounts).reduce((a, b) => a + b, 0);

    if (tipCount > msgCount && tipCount > subCount) {
        updates.buyerType = "tipper";
    } else if (msgCount > tipCount) {
        updates.buyerType = "ppv_buyer";
    } else if (subCount > 0 && totalRecentTx <= 2) {
        updates.buyerType = "subscriber_only";
    }

    // --- Price range detection (only from transaction events to avoid double-counting) ---
    if (isTransactionEvent) {
        const currentSpend = fan.lifetimeSpend || 0; // Already incremented by the upsert
        if (currentSpend >= 200) updates.priceRange = "whale";
        else if (currentSpend >= 50) updates.priceRange = "high";
        else if (currentSpend >= 10) updates.priceRange = "mid";
        else updates.priceRange = "low";
    }

    // --- Stage progression ---
    const currentStage = fan.stage;
    if (!currentStage || currentStage === "new") {
        updates.stage = "warming";
    } else if (currentStage === "warming" && totalRecentTx >= 3) {
        updates.stage = "active_buyer";
    } else if (currentStage === "cooling_off" || currentStage === "at_risk" || currentStage === "churned") {
        updates.stage = "reactivated";
    }

    // Log stage change
    if (updates.stage && updates.stage !== currentStage) {
        updates.stageUpdatedAt = new Date();
        await prisma.fanLifecycleEvent.create({
            data: {
                fanId: fan.id,
                type: "stage_change",
                metadata: { from: currentStage, to: updates.stage, reason: `Purchase: ${purchaseType} $${amount}` },
            },
        }).catch(() => {});
    }

    // --- Average order value ---
    const avgResult = await prisma.transaction.aggregate({
        where: { fanId: fan.id },
        _avg: { amount: true },
        _count: { id: true },
    });
    if (avgResult._avg.amount) {
        updates.avgOrderValue = Math.round(avgResult._avg.amount * 100) / 100;
    }

    // --- Intent score bump (just bought = high intent, decays over time) ---
    updates.intentScore = Math.min(100, (fan.intentScore || 0) + 30);
    updates.lastIntentAt = new Date();

    // --- First purchase + biggest purchase tracking (only from transaction events) ---
    if (isTransactionEvent) {
        if (!fan.firstPurchaseAt) {
            updates.firstPurchaseAt = new Date();
        }
        if (!fan.biggestPurchase || amount > fan.biggestPurchase) {
            updates.biggestPurchase = amount;
        }
    }

    // --- Apply all updates ---
    if (Object.keys(updates).length > 0) {
        await prisma.fan.update({
            where: { id: fan.id },
            data: updates,
        });
    }

    // --- Auto-tag purchase preference ---
    if (purchaseType === "tip") {
        await upsertPreference(fan.id, "tipper", "auto");
    } else if (purchaseType === "message") {
        await upsertPreference(fan.id, "ppv_buyer", "auto");
    }
    if (amount >= 50) {
        await upsertPreference(fan.id, "whale", "auto");
    }
}

async function upsertPreference(fanId: string, tag: string, source: string) {
    try {
        await prisma.fanPreference.upsert({
            where: { fanId_tag: { fanId, tag } },
            create: { fanId, tag, weight: 1.0, source },
            update: {
                weight: { increment: 0.5 },
                lastSeenAt: new Date(),
            },
        });
    } catch {
        // Non-critical
    }
}

async function sendTelegramAlert(creator: any, event: string, fanName: string | null, amount: number, purchaseType: string) {
    let message = "";
    const name = fanName || "Someone";
    const isWhale = amount >= (creator.whaleAlertTarget || 50);

    if (event === "subscriptions.new") {
        message = `${isWhale ? "🐋 WHALE ALERT\n" : ""}💰 **${name}** just subscribed!\nAmount: $${amount.toFixed(2)}`;
    } else if (event === "messages.ppv.unlocked") {
        message = `${isWhale ? "🐋 WHALE ALERT\n" : ""}🔓 **${name}** unlocked a PPV message!\nAmount: $${amount.toFixed(2)}`;
    } else if (event === "tips.received") {
        message = `${isWhale ? "🐋 WHALE ALERT\n" : ""}💎 **${name}** sent a tip!\nAmount: $${amount.toFixed(2)}`;
    } else {
        message = `💸 **${name}** — ${purchaseType}\nAmount: $${amount.toFixed(2)}`;
    }

    try {
        await bot.api.sendMessage(creator.telegramGroupId, message, { parse_mode: "Markdown" });
    } catch (e) {
        console.error("Failed to send telegram alert via webhook", e);
    }
}

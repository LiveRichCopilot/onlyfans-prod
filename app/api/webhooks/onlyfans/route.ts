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

        // Handle purchase events — update Fan.lastPurchaseAt + send Telegram alert
        const purchaseEvents = ["subscriptions.new", "messages.ppv.unlocked", "tips.received", "transactions.new"];
        if (purchaseEvents.includes(payload.event)) {
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

            if (accountId) {
                const creator = await prisma.creator.findFirst({
                    where: { ofapiCreatorId: String(accountId) }
                });

                // --- Update Fan.lastPurchaseAt in DB (persistent memory) ---
                if (creator && fanId) {
                    try {
                        const purchaseDate = new Date(eventTime);
                        await prisma.fan.upsert({
                            where: { ofapiFanId: String(fanId) },
                            update: {
                                lastPurchaseAt: purchaseDate,
                                lastPurchaseType: purchaseType,
                                lastPurchaseAmount: amount,
                                name: fanName || undefined,
                                username: fanUsername || undefined,
                                lifetimeSpend: { increment: amount },
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
                            },
                        });
                        console.log(`Fan ${fanId} (${fanName}) updated: ${purchaseType} $${amount}`);
                    } catch (dbErr: any) {
                        console.error("Failed to update Fan in DB:", dbErr.message);
                    }
                }

                // --- Telegram alert ---
                if (creator?.telegramGroupId) {
                    let message = `**New OnlyFans Event**\n`;
                    if (payload.event === "subscriptions.new") {
                        message += `**${fanName || "Someone"}** just subscribed!\n`;
                        message += `Amount: $${amount.toFixed(2)}\n`;
                        if (amount >= 50) message += `**WHALE ALERT**\n`;
                    } else if (payload.event === "messages.ppv.unlocked") {
                        message += `**${fanName || "Someone"}** unlocked a PPV message!\n`;
                        message += `Amount: $${amount.toFixed(2)}\n`;
                        if (amount >= 50) message += `**WHALE ALERT**\n`;
                    } else if (payload.event === "tips.received") {
                        message += `**${fanName || "Someone"}** sent a tip!\n`;
                        message += `Amount: $${amount.toFixed(2)}\n`;
                        if (amount >= 50) message += `**WHALE ALERT**\n`;
                    } else if (payload.event === "transactions.new") {
                        message += `**${fanName || "Someone"}** — ${purchaseType}\n`;
                        message += `Amount: $${amount.toFixed(2)}\n`;
                    }

                    try {
                        await bot.api.sendMessage(creator.telegramGroupId, message, { parse_mode: "Markdown" });
                    } catch (e) {
                        console.error("Failed to send telegram alert via webhook", e);
                    }
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Webhook processing error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

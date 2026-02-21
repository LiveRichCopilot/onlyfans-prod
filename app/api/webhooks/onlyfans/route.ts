import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { bot } from "@/lib/telegram";

const WEBHOOK_SECRET = process.env.OFAPI_WEBHOOK_SECRET || "temp_secret";

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

        if (signature !== expectedSignature && process.env.NODE_ENV !== "development") {
            console.error("Invalid webhook signature");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        console.log("Received Webhook Event:", payload.event);

        if (payload.event === "subscriptions.new" || payload.event === "messages.ppv.unlocked") {
            const accountId = payload.account_id || payload.data?.creator_id;

            if (accountId) {
                const creator = await prisma.creator.findFirst({
                    where: { ofapiCreatorId: String(accountId) }
                });

                if (creator?.telegramGroupId) {
                    let message = `🔔 **New OnlyFans Event**\n`;
                    if (payload.event === "subscriptions.new") {
                        const amount = payload.data?.amount || 0;
                        const user = payload.data?.user?.name || "Someone";
                        message += `👤 **${user}** just subscribed!\n`;
                        message += `💰 Amount: $${Number(amount).toFixed(2)}\n`;
                        if (amount >= 50) message += `🐳 **WHALE ALERT**\n`;
                    } else if (payload.event === "messages.ppv.unlocked") {
                        const amount = payload.data?.price || 0;
                        const user = payload.data?.buyer?.name || "Someone";
                        message += `🔓 **${user}** unlocked a PPV message!\n`;
                        message += `💵 Amount: $${Number(amount).toFixed(2)}\n`;
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

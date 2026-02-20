import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const url = new URL(req.url);
    if (url.searchParams.get("setup") === "1") {
        try {
            const targetUrl = "https://onlyfans-prod.vercel.app/api/telegram/webhook";
            await bot.api.setWebhook(targetUrl);
            return NextResponse.json({ status: "success", webhook: targetUrl });
        } catch (e: any) {
            return NextResponse.json({ status: "error", message: e.message });
        }
    }
    return NextResponse.json({ status: "ok" });
}

export const POST = webhookCallback(bot, "std/http");

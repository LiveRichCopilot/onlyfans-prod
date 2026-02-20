import { NextResponse } from "next/server";
import { bot } from "@/lib/telegram";

export async function GET() {
    try {
        await bot.api.setMyCommands([
            { command: "stats", description: "Get performance report (e.g. /stats 24h)" },
            { command: "topfans", description: "Find top spenders (e.g. /topfans 1d 1000)" },
            { command: "forecast", description: "Generate AI revenue projection" },
            { command: "notifications", description: "Get unread priority alerts" },
            { command: "testwhale", description: "Trigger Mock Whale Alert" },
            { command: "testchatter", description: "Trigger Mock Chatter Warning" },
            { command: "start", description: "Initialize Bot" }
        ]);

        return NextResponse.json({ success: true, message: "Telegram commands menu registered successfully." });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

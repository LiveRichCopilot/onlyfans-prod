import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionsByType } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const creator = await prisma.creator.findFirst({
            where: { ofapiToken: { not: null } }
        });

        if (!creator || !creator.ofapiToken) {
            return NextResponse.json({ error: "No active creator with an OF API token found." });
        }

        const now = new Date();
        const startWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const payload = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: startWindow.toISOString(),
            end_date: now.toISOString()
        };

        const byType = await getTransactionsByType(creator.ofapiToken, payload);

        return NextResponse.json({ success: true, creator: creator.name, payloadSent: payload, data: byType });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Unknown error" });
    }
}

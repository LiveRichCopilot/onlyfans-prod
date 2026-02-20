import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
    try {
        const creator = await prisma.creator.findFirst({
            where: { ofapiToken: { not: "unlinked" }, active: true }
        });

        if (!creator || !creator.ofapiToken) {
            return NextResponse.json({ error: "No active linked creator" });
        }

        const payload = {
            account_ids: [creator.ofapiCreatorId || creator.telegramId],
            start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString()
        };

        const res = await fetch("https://app.onlyfansapi.com/api/analytics/financial/transactions/by-type", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + creator.ofapiToken
            },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });

        if (!res.ok) {
            return NextResponse.json({ error: "OF API HTTP Error", status: res.status });
        }

        const data = await res.json();
        return NextResponse.json({ success: true, keys: Object.keys(data?.data || data), raw: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

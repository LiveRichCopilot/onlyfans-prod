import { NextResponse } from "next/server";
import { getTransactionsByType } from "@/lib/ofapi";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const creator = await prisma.creator.findFirst({
            where: { ofapiToken: "linked_via_auth_module" }
        });

        if (!creator) return NextResponse.json({ error: "No creator" });

        const now = new Date();
        const startWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const payload = {
            account_ids: [creator.ofapiCreatorId],
            start_date: startWindow.toISOString(),
            end_date: now.toISOString()
        };

        const byType = await getTransactionsByType(creator.ofapiToken, payload);

        return NextResponse.json({ ok: true, payload, byType });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getTransactionsByType } from "../../../../lib/ofapi";

export async function GET() {
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
        return NextResponse.json({ rawData: byType });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

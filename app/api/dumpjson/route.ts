import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const creator = await prisma.creator.findFirst({
            where: { ofapiToken: { not: null } }
        });

        if (!creator || !creator.ofapiToken) {
            return NextResponse.json({ error: "No active creator" });
        }

        const data = await getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);

        return NextResponse.json({ success: true, list: data });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Unknown error" });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const updated = await prisma.creator.updateMany({
            where: { name: "angiyang" },
            data: { telegramGroupId: null, telegramId: "unlinked_angiyang" }
        });
        return NextResponse.json({ success: true, updated: updated.count });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Unknown error" });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "No ID provided" });
    }

    try {
        const updated = await prisma.creator.updateMany({
            where: { name: "angiyang" },
            data: { telegramId: id }
        });
        return NextResponse.json({ success: true, updated: updated.count, message: `Angie's Telegram ID has been updated to ${id} in your production database` });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Unknown error" });
    }
}

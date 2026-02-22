import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get("id");
        const field = req.nextUrl.searchParams.get("field");
        const value = req.nextUrl.searchParams.get("value");

        if (id && field && value) {
            const updated = await prisma.creator.update({
                where: { id },
                data: { [field]: value },
            });
            return NextResponse.json({ success: true, updated: { id: updated.id, name: updated.name, [field]: (updated as any)[field] } });
        }

        // Default: list all creators with their telegram info
        const creators = await prisma.creator.findMany({
            select: { id: true, name: true, telegramId: true, telegramGroupId: true, ofUsername: true },
        });
        return NextResponse.json({ creators });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Unknown error" });
    }
}

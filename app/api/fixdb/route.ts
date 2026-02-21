import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const deleted = await prisma.creator.deleteMany({
            where: { name: "angiyang" }
        });
        return NextResponse.json({ success: true, deleted: deleted.count });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || "Unknown error" });
    }
}

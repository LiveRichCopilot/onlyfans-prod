import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const creators = await prisma.creator.findMany();
        return NextResponse.json({ ok: true, creators, count: creators.length });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}

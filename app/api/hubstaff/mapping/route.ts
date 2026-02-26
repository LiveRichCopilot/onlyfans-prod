import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/hubstaff/mapping
 * Returns all Hubstaff user → chatter email mappings.
 */
export async function GET() {
  try {
    const mappings = await prisma.hubstaffUserMapping.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ mappings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hubstaff/mapping
 * Create a new mapping.
 */
export async function POST(req: NextRequest) {
  try {
    const { hubstaffUserId, hubstaffName, chatterEmail } = await req.json();
    if (!hubstaffUserId || !chatterEmail) {
      return NextResponse.json({ error: "hubstaffUserId and chatterEmail required" }, { status: 400 });
    }

    const mapping = await prisma.hubstaffUserMapping.upsert({
      where: { hubstaffUserId },
      update: { chatterEmail, hubstaffName },
      create: { hubstaffUserId, hubstaffName, chatterEmail },
    });

    return NextResponse.json({ mapping });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/hubstaff/mapping
 * Remove a mapping by ID.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.hubstaffUserMapping.delete({ where: { id } });
    return NextResponse.json({ status: "deleted" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

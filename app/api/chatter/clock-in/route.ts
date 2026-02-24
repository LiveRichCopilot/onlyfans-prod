import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, creatorId } = await req.json();

    if (!email || !creatorId) {
      return NextResponse.json(
        { error: "email and creatorId are required" },
        { status: 400 }
      );
    }

    // Auto-clock-out any existing live session for this email
    await prisma.chatterSession.updateMany({
      where: { email, isLive: true },
      data: { isLive: false, clockOut: new Date() },
    });

    // Create new clock-in session
    const session = await prisma.chatterSession.create({
      data: { email, creatorId },
      include: { creator: { select: { name: true } } },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Clock-in failed:", error);
    return NextResponse.json(
      { error: "Clock-in failed" },
      { status: 500 }
    );
  }
}

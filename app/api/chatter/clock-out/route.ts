import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    const result = await prisma.chatterSession.updateMany({
      where: { email, isLive: true },
      data: { isLive: false, clockOut: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "No active session found for this email" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, sessionsEnded: result.count });
  } catch (error) {
    console.error("Clock-out failed:", error);
    return NextResponse.json(
      { error: "Clock-out failed" },
      { status: 500 }
    );
  }
}

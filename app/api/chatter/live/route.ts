import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const liveSessions = await prisma.chatterSession.findMany({
      where: { isLive: true },
      include: { creator: { select: { name: true } } },
      orderBy: { clockIn: "desc" },
    });

    return NextResponse.json(liveSessions);
  } catch (error) {
    console.error("Failed to fetch live sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch live sessions" },
      { status: 500 }
    );
  }
}

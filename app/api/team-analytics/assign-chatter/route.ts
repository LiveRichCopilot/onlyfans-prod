import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Assign Chatter API — permanent chatter ↔ model assignments via ChatterSchedule
 *
 * POST — Assign one or more chatters to a model (creates ChatterSchedule entries)
 * DELETE ?email=X&creatorId=Y — Unlink a chatter from a model
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorId, chatterEmails } = body as {
      creatorId: string;
      chatterEmails: { email: string; name: string }[];
    };

    if (!creatorId || !chatterEmails?.length) {
      return NextResponse.json(
        { error: "creatorId and chatterEmails[] are required" },
        { status: 400 },
      );
    }

    const results = [];
    for (const ch of chatterEmails) {
      // Upsert — if already assigned with same shift, skip
      const existing = await prisma.chatterSchedule.findFirst({
        where: { email: ch.email, creatorId },
      });
      if (existing) {
        results.push({ email: ch.email, status: "already_assigned" });
        continue;
      }
      await prisma.chatterSchedule.create({
        data: {
          email: ch.email,
          name: ch.name,
          shift: "default",
          creatorId,
        },
      });
      results.push({ email: ch.email, status: "assigned" });
    }

    return NextResponse.json({ results }, { status: 201 });
  } catch (err: any) {
    console.error("[assign-chatter] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    const creatorId = req.nextUrl.searchParams.get("creatorId");

    if (!email || !creatorId) {
      return NextResponse.json(
        { error: "email and creatorId are required" },
        { status: 400 },
      );
    }

    // Delete schedule entries for this chatter on this model
    const sched = await prisma.chatterSchedule.deleteMany({
      where: { email, creatorId },
    });

    // Also close any live sessions for this chatter on this model
    const sessions = await prisma.chatterSession.updateMany({
      where: { email, creatorId, isLive: true },
      data: { isLive: false, clockOut: new Date() },
    });

    return NextResponse.json({
      deleted: true,
      schedulesDeleted: sched.count,
      sessionsClosed: sessions.count,
    });
  } catch (err: any) {
    console.error("[assign-chatter] DELETE error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

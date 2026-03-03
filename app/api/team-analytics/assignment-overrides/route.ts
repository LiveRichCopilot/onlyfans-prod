import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Assignment Override API — Time-boxed manual overrides for chatter ↔ model wiring
 *
 * GET  — List active + recent overrides (last 30 days)
 * POST — Create an override (rejects overlaps with 409)
 * DELETE ?id=X — Remove an override
 */

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const overrides = await prisma.assignmentOverride.findMany({
      where: {
        OR: [
          { endAt: { gt: new Date() } }, // Active now
          { createdAt: { gte: thirtyDaysAgo } }, // Recent
        ],
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { startAt: "desc" },
    });

    return NextResponse.json({
      overrides: overrides.map((o) => ({
        id: o.id,
        creatorId: o.creatorId,
        creatorName: o.creator.name || "Unknown",
        chatterEmail: o.chatterEmail,
        startAt: o.startAt.toISOString(),
        endAt: o.endAt.toISOString(),
        reason: o.reason,
        createdBy: o.createdBy,
        createdAt: o.createdAt.toISOString(),
        isActive: o.startAt <= new Date() && o.endAt > new Date(),
      })),
    });
  } catch (err: any) {
    console.error("[assignment-overrides] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorId, chatterEmail, startAt, endAt, reason, createdBy } = body;

    if (!creatorId || !chatterEmail || !startAt || !endAt) {
      return NextResponse.json(
        { error: "creatorId, chatterEmail, startAt, and endAt are required" },
        { status: 400 },
      );
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (end <= start) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400 },
      );
    }

    // Check for overlapping overrides on the same model
    const overlap = await prisma.assignmentOverride.findFirst({
      where: {
        creatorId,
        startAt: { lt: end },
        endAt: { gt: start },
      },
    });

    if (overlap) {
      return NextResponse.json(
        {
          error: "Overlapping override exists for this model",
          existingOverride: {
            id: overlap.id,
            chatterEmail: overlap.chatterEmail,
            startAt: overlap.startAt.toISOString(),
            endAt: overlap.endAt.toISOString(),
          },
        },
        { status: 409 },
      );
    }

    const override = await prisma.assignmentOverride.create({
      data: {
        creatorId,
        chatterEmail,
        startAt: start,
        endAt: end,
        reason: reason || null,
        createdBy: createdBy || "admin",
      },
    });

    return NextResponse.json({ override }, { status: 201 });
  } catch (err: any) {
    console.error("[assignment-overrides] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.assignmentOverride.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error("[assignment-overrides] DELETE error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/resolve-chatter-email";

export const dynamic = "force-dynamic";

/**
 * GET — Load the recurring shift template.
 * Returns all ScheduleShift entries + creators (models) + chatters (from Hubstaff) for the drag palette.
 */
export async function GET() {
  try {
    const [shifts, creators, hubstaffMappings, liveSessions] = await Promise.all([
      prisma.scheduleShift.findMany({
        orderBy: [{ creatorId: "asc" }, { dayOfWeek: "asc" }, { shiftType: "asc" }],
      }),
      prisma.creator.findMany({
        where: { active: true },
        select: { id: true, name: true, ofUsername: true, avatarUrl: true },
        orderBy: { name: "asc" },
      }),
      prisma.hubstaffUserMapping.findMany({
        select: { chatterEmail: true, hubstaffName: true },
        distinct: ["chatterEmail"],
      }),
      prisma.chatterSession.findMany({
        where: { isLive: true },
        select: { email: true },
        distinct: ["email"],
      }),
    ]);

    // Build chatter list from Hubstaff (source of truth for who's on the team)
    const chatterMap = new Map<string, { email: string; name: string }>();
    for (const h of hubstaffMappings) {
      const email = normalizeEmail(h.chatterEmail);
      if (!chatterMap.has(email)) {
        chatterMap.set(email, {
          email,
          name: h.hubstaffName || email.split("@")[0],
        });
      }
    }
    const chatters = Array.from(chatterMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const liveEmails = liveSessions.map(s => normalizeEmail(s.email));

    return NextResponse.json({ shifts, creators, chatters, liveEmails });
  } catch (err: any) {
    console.error("[schedule] GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST — Create/assign a chatter to a shift slot (upsert).
 * Body: { creatorId, chatterEmail, chatterName?, dayOfWeek, shiftType }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorId, chatterEmail, chatterName, dayOfWeek, shiftType } = body;

    if (!creatorId || !chatterEmail || dayOfWeek == null || !shiftType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!["morning", "afternoon", "night"].includes(shiftType)) {
      return NextResponse.json({ error: "Invalid shiftType" }, { status: 400 });
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: "Invalid dayOfWeek (0-6)" }, { status: 400 });
    }

    const email = normalizeEmail(chatterEmail);

    const shift = await prisma.scheduleShift.upsert({
      where: {
        creatorId_dayOfWeek_shiftType_chatterEmail: {
          creatorId,
          dayOfWeek,
          shiftType,
          chatterEmail: email,
        },
      },
      update: { chatterName: chatterName || null },
      create: {
        creatorId,
        chatterEmail: email,
        chatterName: chatterName || null,
        dayOfWeek,
        shiftType,
      },
    });

    return NextResponse.json(shift);
  } catch (err: any) {
    console.error("[schedule] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT — Move a shift (drag-and-drop to new slot).
 * Body: { id, newCreatorId?, newDayOfWeek?, newShiftType? }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, newCreatorId, newDayOfWeek, newShiftType } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing shift id" }, { status: 400 });
    }

    const existing = await prisma.scheduleShift.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const updatedCreatorId = newCreatorId ?? existing.creatorId;
    const updatedDayOfWeek = newDayOfWeek ?? existing.dayOfWeek;
    const updatedShiftType = newShiftType ?? existing.shiftType;

    if (newShiftType && !["morning", "afternoon", "night"].includes(newShiftType)) {
      return NextResponse.json({ error: "Invalid shiftType" }, { status: 400 });
    }

    // Delete old, create at new position (handles unique constraint changes)
    await prisma.scheduleShift.delete({ where: { id } });

    const shift = await prisma.scheduleShift.upsert({
      where: {
        creatorId_dayOfWeek_shiftType_chatterEmail: {
          creatorId: updatedCreatorId,
          dayOfWeek: updatedDayOfWeek,
          shiftType: updatedShiftType,
          chatterEmail: existing.chatterEmail,
        },
      },
      update: { chatterName: existing.chatterName },
      create: {
        creatorId: updatedCreatorId,
        chatterEmail: existing.chatterEmail,
        chatterName: existing.chatterName,
        dayOfWeek: updatedDayOfWeek,
        shiftType: updatedShiftType,
      },
    });

    return NextResponse.json(shift);
  } catch (err: any) {
    console.error("[schedule] PUT error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE — Remove shift(s).
 * Query param: ?id=xxx           → delete one shift
 * Query param: ?dayOfWeek=2      → bulk clear all shifts for that day
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const dayParam = req.nextUrl.searchParams.get("dayOfWeek");

    if (id) {
      await prisma.scheduleShift.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (dayParam !== null) {
      const dayOfWeek = parseInt(dayParam);
      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json({ error: "Invalid dayOfWeek (0-6)" }, { status: 400 });
      }
      const result = await prisma.scheduleShift.deleteMany({ where: { dayOfWeek } });
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    return NextResponse.json({ error: "Provide ?id=xxx or ?dayOfWeek=N" }, { status: 400 });
  } catch (err: any) {
    console.error("[schedule] DELETE error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

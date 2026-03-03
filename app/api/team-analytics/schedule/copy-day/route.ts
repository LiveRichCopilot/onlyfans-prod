import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST — Atomically copy one day's shifts to all other days.
 * Clears target days first, then inserts copies — all in one DB transaction.
 * Body: { sourceDayOfWeek: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { sourceDayOfWeek } = await req.json();

    if (sourceDayOfWeek == null || sourceDayOfWeek < 0 || sourceDayOfWeek > 6) {
      return NextResponse.json({ error: "Invalid sourceDayOfWeek (0-6)" }, { status: 400 });
    }

    const targetDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== sourceDayOfWeek);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Read source day shifts
      const sourceShifts = await tx.scheduleShift.findMany({
        where: { dayOfWeek: sourceDayOfWeek },
        select: { creatorId: true, chatterEmail: true, chatterName: true, shiftType: true },
      });

      if (sourceShifts.length === 0) {
        return { copied: 0, cleared: 0 };
      }

      // 2. Clear all target days
      let totalCleared = 0;
      for (const day of targetDays) {
        const del = await tx.scheduleShift.deleteMany({ where: { dayOfWeek: day } });
        totalCleared += del.count;
      }

      // 3. Insert copies for each target day
      const inserts = targetDays.flatMap((day) =>
        sourceShifts.map((s) => ({
          creatorId: s.creatorId,
          chatterEmail: s.chatterEmail,
          chatterName: s.chatterName,
          dayOfWeek: day,
          shiftType: s.shiftType,
        }))
      );

      await tx.scheduleShift.createMany({ data: inserts, skipDuplicates: true });

      return { copied: inserts.length, cleared: totalCleared };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[schedule/copy-day] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

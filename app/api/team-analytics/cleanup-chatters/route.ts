import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/resolve-chatter-email";

export const dynamic = "force-dynamic";

/**
 * POST /api/team-analytics/cleanup-chatters
 * Remove departed chatters from all tables.
 * Body: { remove: ["email1", "email2", ...] }
 */
export async function POST(req: NextRequest) {
  try {
    const { remove } = (await req.json()) as { remove: string[] };
    if (!remove?.length) {
      return NextResponse.json({ error: "remove[] required" }, { status: 400 });
    }

    const results = [];
    for (const raw of remove) {
      const email = normalizeEmail(raw);

      // Search both raw and normalized to catch +tags stored in DB
      const emails = [raw.trim().toLowerCase(), email].filter((v, i, a) => a.indexOf(v) === i);

      const sched = await prisma.chatterSchedule.deleteMany({ where: { email: { in: emails } } });
      const mapping = await prisma.hubstaffUserMapping.deleteMany({ where: { chatterEmail: { in: emails } } });
      const sessions = await prisma.chatterSession.updateMany({
        where: { email: { in: emails }, isLive: true },
        data: { isLive: false, clockOut: new Date() },
      });

      results.push({
        email,
        schedulesDeleted: sched.count,
        mappingsDeleted: mapping.count,
        sessionsClosed: sessions.count,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

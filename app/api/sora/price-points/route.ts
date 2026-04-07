import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSoraAuthSafe, canAccessModel } from "@/lib/sora-access";
import { analyzeRows, type RawRow } from "@/lib/sora-analysis";
import { refreshModelMassMessages } from "@/lib/sora-live-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/sora/price-points?modelId=xxx&days=14&skipLive=0
 *
 * Each call LIVE-fetches the latest mass message data from OFAPI for
 * the selected model, merges the authoritative /buyers purchase counts
 * into OutboundCreative, then reads everything back and runs analysis.
 *
 * Why live every time: background crons lag (only 5 creators per 15
 * min, and they previously limited to 7 days — stale for anything
 * older). Sora needs the same numbers OF shows right now.
 *
 * Pass skipLive=1 to bypass the live fetch (useful for debugging or
 * when you just want cached data).
 */
export async function GET(req: Request) {
  try {
    const ctx = await getSoraAuthSafe();
    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const daysRaw = searchParams.get("days");
    const skipLive = searchParams.get("skipLive") === "1";
    const days = Math.min(60, Math.max(1, parseInt(daysRaw || "14", 10) || 14));

    if (!modelId) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    const allowed = await canAccessModel(ctx, modelId);
    if (!allowed) {
      return NextResponse.json({ error: "Not authorized for this model" }, { status: 403 });
    }

    const model = await prisma.creator.findUnique({
      where: { id: modelId },
      select: { id: true, name: true, ofUsername: true, ofapiCreatorId: true },
    });
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Live-refresh before reading so the numbers match OF exactly.
    let refreshResult: { refreshed: number; errors: number } | null = null;
    if (!skipLive && model.ofapiCreatorId) {
      refreshResult = await refreshModelMassMessages({
        creatorId: model.id,
        ofapiCreatorId: model.ofapiCreatorId,
        days,
      });
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    const rows = await prisma.outboundCreative.findMany({
      where: {
        creatorId: modelId,
        source: "mass_message",
        sentAt: { gte: startDate, lte: endDate },
        isCanceled: false,
      },
      select: {
        id: true,
        externalId: true,
        sentAt: true,
        textPlain: true,
        textHtml: true,
        priceCents: true,
        sentCount: true,
        purchasedCount: true,
        isFree: true,
        raw: true,
        media: {
          select: {
            thumbUrl: true,
            previewUrl: true,
            fullUrl: true,
            permanentUrl: true,
            mediaType: true,
          },
          take: 1,
        },
      },
      orderBy: { sentAt: "desc" },
    });

    const analysis = analyzeRows(rows as RawRow[]);

    return NextResponse.json({
      model: { id: model.id, name: model.name, ofUsername: model.ofUsername },
      windowDays: days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...analysis,
    });
  } catch (err: any) {
    console.error("[sora/price-points]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

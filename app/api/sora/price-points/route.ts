import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSoraAuthSafe, canAccessModel } from "@/lib/sora-access";
import { analyzeRows, type RawRow } from "@/lib/sora-analysis";

export const dynamic = "force-dynamic";

/**
 * GET /api/sora/price-points?modelId=xxx&days=14
 *
 * Reads her mass messages from OutboundCreative (cron-populated every
 * 10 min) and runs the analysis in lib/sora-analysis.ts to return:
 *   - pricePoints: actual distinct prices, ranked by total $ earned
 *   - pricePointsNoEarnings: prices she tried but earned $0
 *   - suggestedPricePoints: what to try next week based on her data
 *   - captionsPerformedSuccessfully / captionsPerformedPoorly
 *   - patterns: observations she might be missing (time of day, day
 *     of week, reused captions, untried prices, dormant winners,
 *     price resistance)
 *
 * Access: any logged-in user who owns this model (admins see all).
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
      select: { id: true, name: true, ofUsername: true },
    });
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
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

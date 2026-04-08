import { NextResponse } from "next/server";
import { getSoraAuthSafe, canAccessModel } from "@/lib/sora-access";
import { getCrossCreatorWhales } from "@/lib/sora-whales";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/sora/whales?modelId=xxx&minSpend=200&limit=20
 *
 * Cross-creator whale discovery: fans who have spent across 2+ creators
 * in the agency. Returned with status:
 *   - hidden_whale  → spent $500+ on other creators, $0 on this one
 *   - low_engagement → spent on this one, but 3x more elsewhere
 *   - engaged_whale → buying from this model in proportion to others
 */
export async function GET(req: Request) {
  try {
    const ctx = await getSoraAuthSafe();
    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const minSpend = parseFloat(searchParams.get("minSpend") || "200");
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10) || 20);

    if (!modelId) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    const allowed = await canAccessModel(ctx, modelId);
    if (!allowed) {
      return NextResponse.json({ error: "Not authorized for this model" }, { status: 403 });
    }

    const whales = await getCrossCreatorWhales({
      modelId,
      minTotalSpend: minSpend,
      limit,
    });

    return NextResponse.json({ whales });
  } catch (err: any) {
    console.error("[sora/whales]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

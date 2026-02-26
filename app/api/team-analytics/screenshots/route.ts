import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScreenshots, HubstaffScreenshot } from "@/lib/hubstaff";
import { analyzeScreenshots, ScreenshotAnalysis } from "@/lib/screenshot-analyzer";

export const dynamic = "force-dynamic";

/**
 * Screenshot Timeline API
 *
 * GET /api/team-analytics/screenshots?email=xxx&date=2026-02-26
 *   - Returns raw screenshots for the chatter on that date
 *
 * GET /api/team-analytics/screenshots?email=xxx&date=2026-02-26&analyze=true
 *   - Also runs AI vision analysis on sampled screenshots (max 20)
 *
 * Response: {
 *   screenshots: HubstaffScreenshot[],
 *   analysis: ScreenshotAnalysis[] | null,
 *   summary: { totalScreenshots, analyzedCount, onOfPct, flaggedCount, sameScreenStreak } | null
 * }
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const analyze = req.nextUrl.searchParams.get("analyze") === "true";

  // Default to today in UK timezone
  const targetDate =
    dateParam || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const isoStart = `${targetDate}T00:00:00Z`;
  const isoEnd = `${targetDate}T23:59:59Z`;

  try {
    // Step 1: Find Hubstaff user mapping
    const mapping = await prisma.hubstaffUserMapping.findFirst({
      where: { chatterEmail: email },
    });

    if (!mapping) {
      return NextResponse.json({
        screenshots: [],
        analysis: null,
        summary: null,
        error: "No Hubstaff mapping found for this email",
      });
    }

    const hsUserId = parseInt(mapping.hubstaffUserId);

    // Step 2: Fetch screenshots from Hubstaff
    let allScreenshots: HubstaffScreenshot[];
    try {
      allScreenshots = await getScreenshots(isoStart, isoEnd);
    } catch (e: any) {
      console.error("[screenshots] Hubstaff fetch error:", e.message);
      return NextResponse.json({
        screenshots: [],
        analysis: null,
        summary: null,
        error: `Hubstaff API error: ${e.message}`,
      });
    }

    // Step 3: Filter to this user
    const userScreenshots = allScreenshots
      .filter((s) => s.user_id === hsUserId)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    // Step 4: Run AI analysis if requested
    let analysis: ScreenshotAnalysis[] | null = null;
    let summary: {
      totalScreenshots: number;
      analyzedCount: number;
      onOfPct: number;
      flaggedCount: number;
      sameScreenStreak: number;
    } | null = null;

    if (analyze && userScreenshots.length > 0) {
      const toAnalyze = userScreenshots.map((s) => ({
        id: s.id,
        url: s.url,
        recorded_at: s.recorded_at,
      }));

      analysis = await analyzeScreenshots(toAnalyze);

      // Compute summary
      const analyzedCount = analysis.length;
      const onOfCount = analysis.filter((a) => a.onOnlyFans).length;
      const flaggedCount = analysis.filter((a) => a.flagged).length;
      const onOfPct = analyzedCount > 0 ? Math.round((onOfCount / analyzedCount) * 100) : 0;

      // Same-screen streak: longest run of near-identical descriptions
      const sameScreenStreak = computeSameScreenStreak(analysis);

      summary = {
        totalScreenshots: userScreenshots.length,
        analyzedCount,
        onOfPct,
        flaggedCount,
        sameScreenStreak,
      };
    }

    return NextResponse.json({
      screenshots: userScreenshots,
      analysis,
      summary: summary || {
        totalScreenshots: userScreenshots.length,
        analyzedCount: 0,
        onOfPct: 0,
        flaggedCount: 0,
        sameScreenStreak: 0,
      },
    });
  } catch (err: any) {
    console.error("[screenshots] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Compute the longest streak of consecutive screenshots with nearly identical descriptions.
 * Each screenshot interval is ~10 minutes, so streak * 10 = idle minutes.
 */
function computeSameScreenStreak(analysis: ScreenshotAnalysis[]): number {
  if (analysis.length < 2) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < analysis.length; i++) {
    const prev = analysis[i - 1];
    const curr = analysis[i];

    // Consider "same screen" if same app + same activity + both idle or similar description
    const sameApp = prev.app === curr.app;
    const sameActivity = prev.activity === curr.activity;
    const bothIdle = prev.activity === "idle" && curr.activity === "idle";
    const similarDesc = stringSimilarity(prev.description, curr.description) > 0.7;

    if ((sameApp && sameActivity && similarDesc) || bothIdle) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  // Only flag if 3+ consecutive similar screenshots (30+ min of stale screen)
  return maxStreak >= 3 ? maxStreak : 0;
}

/** Simple word-overlap similarity (0-1). */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

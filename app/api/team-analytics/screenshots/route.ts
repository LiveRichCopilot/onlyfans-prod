import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScreenshots, HubstaffScreenshot } from "@/lib/hubstaff";
import { analyzeScreenshots, ScreenshotAnalysis } from "@/lib/screenshot-analyzer";
import { uploadScreenshotBatch, isStorageConfigured } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

/**
 * Screenshot Timeline API — with Supabase caching
 *
 * GET /api/team-analytics/screenshots?email=xxx&date=2026-02-26
 *   - Returns screenshots (from cache if available, otherwise fetches + caches)
 *
 * GET /api/team-analytics/screenshots?email=xxx&date=2026-02-26&analyze=true
 *   - Also runs AI vision analysis (cached — won't re-analyze if already done)
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const analyze = req.nextUrl.searchParams.get("analyze") === "true";

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

    // Step 2: Check cache first
    const dayStart = new Date(isoStart);
    const dayEnd = new Date(isoEnd);
    const cached = await prisma.cachedScreenshot.findMany({
      where: {
        hubstaffUserId: hsUserId,
        recordedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { recordedAt: "asc" },
    });

    let screenshots: { id: number; url: string; thumb_url: string; recorded_at: string; user_id: number }[];
    let cachedAnalysisMap: Map<number, ScreenshotAnalysis> | null = null;

    if (cached.length > 0) {
      // Serve from cache — permanent URLs
      screenshots = cached.map((c) => ({
        id: c.hubstaffScreenshotId,
        url: c.supabaseUrl || "",
        thumb_url: c.thumbUrl || c.supabaseUrl || "",
        recorded_at: c.recordedAt.toISOString(),
        user_id: c.hubstaffUserId,
      }));

      // Build analysis from cached data if it exists
      const analyzedCache = cached.filter((c) => c.analyzedAt);
      if (analyzedCache.length > 0) {
        cachedAnalysisMap = new Map();
        for (const c of analyzedCache) {
          cachedAnalysisMap.set(c.hubstaffScreenshotId, {
            screenshotId: c.hubstaffScreenshotId,
            timestamp: c.recordedAt.toISOString(),
            app: c.analysisApp || "Unknown",
            activity: (c.analysisActivity as ScreenshotAnalysis["activity"]) || "other",
            onOnlyFans: c.analysisOnOf ?? false,
            description: c.analysisDescription || "",
            reason: c.analysisReason || "",
            flagged: c.analysisFlagged ?? false,
            analysisFailed: c.analysisFailed ?? false,
          });
        }
      }
    } else {
      // Fetch fresh from Hubstaff
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

      const userScreenshots = allScreenshots
        .filter((s) => s.user_id === hsUserId)
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

      // Upload to Supabase Storage in background (non-blocking for user)
      if (isStorageConfigured() && userScreenshots.length > 0) {
        // Fire and don't await — cache in background
        cacheScreenshots(userScreenshots, email).catch((e) =>
          console.error("[screenshots] Cache error:", e.message)
        );
      }

      screenshots = userScreenshots.map((s) => ({
        id: s.id,
        url: s.url,
        thumb_url: s.thumb_url,
        recorded_at: s.recorded_at,
        user_id: s.user_id,
      }));
    }

    // Step 3: Run AI analysis if requested
    let analysis: ScreenshotAnalysis[] | null = null;

    if (analyze && screenshots.length > 0) {
      if (cachedAnalysisMap && cachedAnalysisMap.size > 0) {
        // Use cached analysis
        analysis = [...cachedAnalysisMap.values()];
      } else {
        // Run fresh analysis
        const toAnalyze = screenshots.map((s) => ({
          id: s.id,
          url: s.url,
          recorded_at: s.recorded_at,
        }));

        analysis = await analyzeScreenshots(toAnalyze);

        // Cache analysis results in DB (background)
        cacheAnalysisResults(analysis).catch((e) =>
          console.error("[screenshots] Analysis cache error:", e.message)
        );
      }
    }

    // Step 4: Build summary
    let summary: {
      totalScreenshots: number;
      analyzedCount: number;
      onOfPct: number;
      flaggedCount: number;
      sameScreenStreak: number;
    } | null = null;

    if (analysis) {
      const successfulAnalyses = analysis.filter((a) => !a.analysisFailed);
      const analyzedCount = successfulAnalyses.length;
      const onOfCount = successfulAnalyses.filter((a) => a.onOnlyFans).length;
      const flaggedCount = successfulAnalyses.filter((a) => a.flagged).length;
      const onOfPct = analyzedCount > 0 ? Math.round((onOfCount / analyzedCount) * 100) : 0;
      const sameScreenStreak = computeSameScreenStreak(analysis);

      summary = {
        totalScreenshots: screenshots.length,
        analyzedCount,
        onOfPct,
        flaggedCount,
        sameScreenStreak,
      };
    }

    return NextResponse.json({
      screenshots,
      analysis,
      summary: summary || {
        totalScreenshots: screenshots.length,
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

/** Cache screenshots to Supabase Storage + DB */
async function cacheScreenshots(
  screenshots: HubstaffScreenshot[],
  chatterEmail: string,
) {
  // Upload images to Supabase
  const uploaded = await uploadScreenshotBatch(
    screenshots.map((s) => ({
      id: s.id,
      url: s.url,
      user_id: s.user_id,
      recorded_at: s.recorded_at,
    }))
  );

  // Upsert into DB
  for (const ss of screenshots) {
    const urls = uploaded.get(ss.id);
    await prisma.cachedScreenshot.upsert({
      where: { hubstaffScreenshotId: ss.id },
      create: {
        hubstaffScreenshotId: ss.id,
        hubstaffUserId: ss.user_id,
        chatterEmail,
        recordedAt: new Date(ss.recorded_at),
        supabaseUrl: urls?.url || null,
        thumbUrl: urls?.thumbUrl || null,
      },
      update: {
        supabaseUrl: urls?.url || undefined,
        thumbUrl: urls?.thumbUrl || undefined,
      },
    });
  }
}

/** Cache analysis results into existing CachedScreenshot rows */
async function cacheAnalysisResults(analysis: ScreenshotAnalysis[]) {
  for (const a of analysis) {
    await prisma.cachedScreenshot.upsert({
      where: { hubstaffScreenshotId: a.screenshotId },
      create: {
        hubstaffScreenshotId: a.screenshotId,
        hubstaffUserId: 0, // Will be filled by screenshot cache
        recordedAt: new Date(a.timestamp),
        analysisApp: a.app,
        analysisActivity: a.activity,
        analysisOnOf: a.onOnlyFans,
        analysisDescription: a.description,
        analysisReason: a.reason,
        analysisFlagged: a.flagged,
        analysisFailed: a.analysisFailed,
        analyzedAt: new Date(),
      },
      update: {
        analysisApp: a.app,
        analysisActivity: a.activity,
        analysisOnOf: a.onOnlyFans,
        analysisDescription: a.description,
        analysisReason: a.reason,
        analysisFlagged: a.flagged,
        analysisFailed: a.analysisFailed,
        analyzedAt: new Date(),
      },
    });
  }
}

/** Compute the longest streak of consecutive screenshots with similar descriptions. */
function computeSameScreenStreak(analysis: ScreenshotAnalysis[]): number {
  if (analysis.length < 2) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < analysis.length; i++) {
    const prev = analysis[i - 1];
    const curr = analysis[i];

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

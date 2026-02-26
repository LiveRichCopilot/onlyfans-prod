import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildScoringWindows } from "@/lib/chatter-scorer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/debug/scoring-pipeline
 *
 * Diagnostic endpoint that checks every prerequisite for the scoring pipeline.
 * Hit this on production to understand why scores = 0.
 *
 * Checks:
 * 1. Env vars (MOONSHOT_API_KEY, OPENAI_API_KEY, CRON_SECRET)
 * 2. ChatterHourlyScore record count
 * 3. Creators with OFAPI credentials
 * 4. Active ChatterSessions
 * 5. Current scoring window + buildScoringWindows result
 * 6. Kimi K2.5 API connectivity test
 * 7. Recent cron results (if any scores exist)
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  // --- 1. Environment Variables ---
  checks.envVars = {
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY ? `set (${process.env.MOONSHOT_API_KEY.slice(0, 8)}...)` : "MISSING",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.slice(0, 8)}...)` : "MISSING",
    CRON_SECRET: process.env.CRON_SECRET ? "set" : "MISSING",
    KIMI_API_KEY: process.env.KIMI_API_KEY ? `set (${process.env.KIMI_API_KEY.slice(0, 8)}...)` : "not set (using MOONSHOT_API_KEY)",
  };

  // --- 2. ChatterHourlyScore Records ---
  const [totalScores, recentScores, oldestScore, newestScore] = await Promise.all([
    prisma.chatterHourlyScore.count(),
    prisma.chatterHourlyScore.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.chatterHourlyScore.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true, totalScore: true, chatterEmail: true } }),
    prisma.chatterHourlyScore.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, totalScore: true, chatterEmail: true, slaScore: true, followupScore: true, triggerScore: true, qualityScore: true, revenueScore: true, aiNotes: true } }),
  ]);

  checks.hourlyScores = {
    totalRecords: totalScores,
    last24h: recentScores,
    oldest: oldestScore,
    newest: newestScore,
    verdict: totalScores === 0
      ? "NO RECORDS - Scoring pipeline has NEVER produced a score"
      : recentScores === 0
        ? `${totalScores} total but none in last 24h - pipeline may have stopped`
        : `${recentScores} scores in last 24h - pipeline is running`,
  };

  // --- 3. Creators with OFAPI credentials ---
  const creators = await prisma.creator.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      ofapiToken: true,
      ofapiCreatorId: true,
    },
  });

  const creatorsWithApi = creators.filter(c => c.ofapiToken && c.ofapiCreatorId);
  checks.creators = {
    total: creators.length,
    withOfapiCredentials: creatorsWithApi.length,
    list: creators.map(c => ({
      name: c.name,
      hasToken: !!c.ofapiToken,
      hasCreatorId: !!c.ofapiCreatorId,
      tokenPreview: c.ofapiToken ? `${c.ofapiToken.slice(0, 10)}...` : null,
    })),
    verdict: creatorsWithApi.length === 0
      ? "NO CREATORS HAVE OFAPI CREDENTIALS - buildScoringWindows will always return 0 windows"
      : `${creatorsWithApi.length} creator(s) have OFAPI credentials`,
  };

  // --- 4. ChatterSessions ---
  const [totalSessions, liveSessions, recentSessions] = await Promise.all([
    prisma.chatterSession.count(),
    prisma.chatterSession.findMany({
      where: { isLive: true },
      select: { email: true, creatorId: true, clockIn: true, source: true },
    }),
    prisma.chatterSession.findMany({
      where: { clockIn: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { email: true, creatorId: true, clockIn: true, clockOut: true, isLive: true, source: true },
      orderBy: { clockIn: "desc" },
      take: 20,
    }),
  ]);

  checks.sessions = {
    totalEver: totalSessions,
    liveNow: liveSessions.length,
    liveDetails: liveSessions,
    recentSessions: recentSessions.map(s => ({
      email: s.email,
      creatorId: s.creatorId,
      clockIn: s.clockIn.toISOString(),
      clockOut: s.clockOut?.toISOString() || "still live",
      isLive: s.isLive,
      source: s.source,
    })),
    verdict: liveSessions.length === 0
      ? "NO LIVE SESSIONS - No chatters are currently clocked in"
      : `${liveSessions.length} live session(s)`,
  };

  // --- 5. Current Scoring Window ---
  const now = new Date();
  const ukFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = ukFormatter.formatToParts(now);
  const ukHour = parseInt(parts.find(p => p.type === "hour")!.value);
  const ukDay = parts.find(p => p.type === "day")!.value;
  const ukMonth = parts.find(p => p.type === "month")!.value;

  // Replicate the cron's window calculation
  const ukYear = parseInt(parts.find(p => p.type === "year")!.value);
  const ukMonthNum = parseInt(ukMonth) - 1;
  const ukDayNum = parseInt(ukDay);

  const windowEndUK = new Date(Date.UTC(ukYear, ukMonthNum, ukDayNum, ukHour, 0, 0, 0));
  const windowStartUK = new Date(Date.UTC(ukYear, ukMonthNum, ukDayNum, ukHour - 1, 0, 0, 0));

  // UK offset
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const ukStr = now.toLocaleString("en-US", { timeZone: "Europe/London" });
  const ukOffset = new Date(ukStr).getTime() - new Date(utcStr).getTime();

  const windowStart = new Date(windowStartUK.getTime() - ukOffset);
  const windowEnd = new Date(windowEndUK.getTime() - ukOffset);

  let windowResults;
  try {
    const windows = await buildScoringWindows(windowStart, windowEnd);
    windowResults = {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      ukTime: `${ukDay}/${ukMonth} ${ukHour}:${parts.find(p => p.type === "minute")!.value}`,
      pairsFound: windows.length,
      pairs: windows.map(w => ({
        chatter: w.chatterEmail,
        creator: w.creatorName,
        creatorId: w.creatorId,
        confidence: w.attributionConfidence,
      })),
      verdict: windows.length === 0
        ? "NO SCORING WINDOWS - No sessions overlap the last completed UK hour, or creators lack OFAPI credentials"
        : `${windows.length} pair(s) would be scored`,
    };
  } catch (e: any) {
    windowResults = { error: e.message };
  }
  checks.scoringWindow = windowResults;

  // --- 6. Kimi K2.5 API Test ---
  const moonKey = process.env.MOONSHOT_API_KEY;
  if (moonKey) {
    try {
      const testRes = await fetch("https://api.moonshot.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${moonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kimi-k2.5",
          messages: [{ role: "user", content: "Reply with just the word: OK" }],
          thinking: { type: "disabled" },
          max_tokens: 10,
        }),
      });

      if (testRes.ok) {
        const data = await testRes.json();
        checks.kimiApi = {
          status: "OK",
          response: data.choices?.[0]?.message?.content,
          model: data.model,
          usage: data.usage,
        };
      } else {
        const errText = await testRes.text();
        checks.kimiApi = {
          status: "FAILED",
          httpStatus: testRes.status,
          error: errText.slice(0, 500),
          verdict: testRes.status === 401
            ? "MOONSHOT_API_KEY is invalid or expired"
            : `Kimi API returned ${testRes.status}`,
        };
      }
    } catch (e: any) {
      checks.kimiApi = { status: "ERROR", error: e.message };
    }
  } else {
    checks.kimiApi = {
      status: "SKIPPED",
      verdict: "MOONSHOT_API_KEY not set - AI scoring will always return null, all AI-scored categories = 0",
    };
  }

  // --- 7. OpenAI API Test (for Hints/Classify) ---
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const testRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [{ role: "user", content: "Reply with just the word: OK" }],
          max_completion_tokens: 10,
        }),
      });

      if (testRes.ok) {
        const data = await testRes.json();
        checks.openaiApi = {
          status: "OK",
          response: data.choices?.[0]?.message?.content,
          model: data.model,
        };
      } else {
        const errText = await testRes.text();
        checks.openaiApi = {
          status: "FAILED",
          httpStatus: testRes.status,
          error: errText.slice(0, 500),
        };
      }
    } catch (e: any) {
      checks.openaiApi = { status: "ERROR", error: e.message };
    }
  } else {
    checks.openaiApi = { status: "SKIPPED", verdict: "OPENAI_API_KEY not set" };
  }

  // --- 8. ChatterProfiles (EMA averages) ---
  const profiles = await prisma.chatterProfile.findMany({
    select: {
      chatterEmail: true,
      avgTotalScore: true,
      totalScoringSessions: true,
      dominantArchetype: true,
      updatedAt: true,
    },
  });

  checks.profiles = {
    total: profiles.length,
    list: profiles,
    verdict: profiles.length === 0
      ? "NO PROFILES - scoring has never completed successfully"
      : `${profiles.length} profile(s) exist`,
  };

  // --- Overall Diagnosis ---
  const issues: string[] = [];
  if (!moonKey) issues.push("MOONSHOT_API_KEY not set - AI scoring disabled");
  if (!openaiKey) issues.push("OPENAI_API_KEY not set - Hints/Classify disabled");
  if (creatorsWithApi.length === 0) issues.push("No creators have OFAPI credentials (ofapiToken + ofapiCreatorId)");
  if (totalSessions === 0) issues.push("No ChatterSessions exist at all");
  if (totalScores === 0) issues.push("No ChatterHourlyScore records exist - pipeline never produced output");
  if (liveSessions.length === 0 && totalSessions > 0) issues.push("Sessions exist but none are live right now");

  checks.diagnosis = {
    issues: issues.length > 0 ? issues : ["No obvious issues detected"],
    recommendation: issues.length > 0
      ? "Fix the issues above. Most likely: creators need ofapiToken + ofapiCreatorId set, or chatters need to be clocked in during the scoring window."
      : "Pipeline looks healthy. Check Vercel runtime logs for [PerfScore] entries.",
  };

  return NextResponse.json(checks, { status: 200 });
}

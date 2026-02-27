import { NextResponse } from "next/server";
import { getScreenshots, getAccessToken } from "@/lib/hubstaff";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Debug endpoint to test raw Hubstaff screenshots API.
 * GET /api/debug/hubstaff-screenshots?date=2026-02-26
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59Z`;

  try {
    const config = await prisma.hubstaffConfig.findFirst();
    if (!config) return NextResponse.json({ error: "No Hubstaff config" });

    // Test 1: Raw API call to see what comes back
    const token = await getAccessToken();
    const orgId = config.organizationId;
    const url = `https://api.hubstaff.com/v2/organizations/${orgId}/screenshots?time_slot[start]=${encodeURIComponent(start)}&time_slot[stop]=${encodeURIComponent(end)}&page_limit=10`;

    const rawRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const rawStatus = rawRes.status;
    const rawText = await rawRes.text();

    // Test 2: Via our wrapper
    let wrapperResult: any = null;
    let wrapperError: string | null = null;
    try {
      const screenshots = await getScreenshots(start, end);
      wrapperResult = {
        count: screenshots.length,
        sample: screenshots.slice(0, 3).map((s) => ({
          id: s.id,
          url: s.url?.substring(0, 100),
          urlFull: s.url,
          recorded_at: s.recorded_at,
          user_id: s.user_id,
        })),
      };
    } catch (e: any) {
      wrapperError = e.message;
    }

    return NextResponse.json({
      date,
      start,
      end,
      orgId,
      rawApiCall: {
        url: url.replace(token, "TOKEN_REDACTED"),
        status: rawStatus,
        body: rawText.substring(0, 2000),
      },
      wrapper: wrapperResult,
      wrapperError,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

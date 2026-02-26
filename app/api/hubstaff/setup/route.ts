import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/hubstaff/setup
 * Bootstrap Hubstaff credentials. Called once during initial setup.
 */
export async function POST(req: NextRequest) {
  try {
    const { refreshToken, organizationId } = await req.json();
    if (!refreshToken || !organizationId) {
      return NextResponse.json({ error: "refreshToken and organizationId required" }, { status: 400 });
    }

    // Exchange refresh token for an access token
    const TOKEN_URL = "https://account.hubstaff.com/access_tokens";
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 400 });
    }

    const data = await res.json();

    // Upsert config
    const config = await prisma.hubstaffConfig.upsert({
      where: { organizationId },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
        syncEnabled: true,
      },
      create: {
        organizationId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
      },
    });

    return NextResponse.json({
      status: "ok",
      organizationId: config.organizationId,
      tokenExpiresAt: config.tokenExpiresAt,
      syncEnabled: config.syncEnabled,
    });
  } catch (err: any) {
    console.error("Hubstaff setup error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/hubstaff/setup
 * Check current Hubstaff config status.
 */
export async function GET() {
  try {
    const config = await prisma.hubstaffConfig.findFirst();
    if (!config) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({
      configured: true,
      organizationId: config.organizationId,
      syncEnabled: config.syncEnabled,
      lastSyncAt: config.lastSyncAt,
      tokenExpiresAt: config.tokenExpiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://account.hubstaff.com/access_tokens";

// --- DPoP helpers (inline to avoid circular deps) ---

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  return { privateKey, publicJwk, privatePem };
}

function createDpopProof(
  privateKey: crypto.KeyObject,
  publicJwk: JsonWebKey,
  method: string,
  url: string,
): string {
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: publicJwk };
  const payload = {
    htm: method,
    htu: url,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID(),
  };

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.sign("sha256", Buffer.from(`${headerB64}.${payloadB64}`), privateKey);

  return `${headerB64}.${payloadB64}.${base64url(sig)}`;
}

/**
 * POST /api/hubstaff/setup
 * Bootstrap or update Hubstaff credentials.
 * Body: { refreshToken, organizationId }
 */
export async function POST(req: NextRequest) {
  try {
    const { refreshToken, organizationId } = await req.json();
    if (!refreshToken || !organizationId) {
      return NextResponse.json({ error: "refreshToken and organizationId required" }, { status: 400 });
    }

    // Generate DPoP key pair for token exchange (Hubstaff requires DPoP RFC 9449)
    const { privateKey, publicJwk, privatePem } = generateKeyPair();
    const dpopProof = createDpopProof(privateKey, publicJwk, "POST", TOKEN_URL);

    // Exchange refresh token for an access token WITH DPoP
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "DPoP": dpopProof,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 400 });
    }

    const data = await res.json();

    // Upsert config — store tokens AND DPoP keys together
    const config = await prisma.hubstaffConfig.upsert({
      where: { organizationId },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
        syncEnabled: true,
        dpopPrivateKey: privatePem,
        dpopPublicKey: JSON.stringify(publicJwk),
      },
      create: {
        organizationId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
        dpopPrivateKey: privatePem,
        dpopPublicKey: JSON.stringify(publicJwk),
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

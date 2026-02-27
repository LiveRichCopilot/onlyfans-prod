import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

export const HUBSTAFF_API = "https://api.hubstaff.com/v2";
const TOKEN_URL = "https://account.hubstaff.com/access_tokens";

// --- DPoP Key Management ---

type KeyPair = { privateKey: crypto.KeyObject; publicJwk: JsonWebKey };

let cachedKeyPair: KeyPair | null = null;

async function getDpopKeyPair(configId?: string): Promise<KeyPair> {
  if (cachedKeyPair) return cachedKeyPair;

  // Try loading from DB — keys were stored during token exchange
  if (configId) {
    const config = await prisma.hubstaffConfig.findUnique({ where: { id: configId } });
    if (config?.dpopPrivateKey && config?.dpopPublicKey) {
      const privateKey = crypto.createPrivateKey(config.dpopPrivateKey);
      const publicJwk = JSON.parse(config.dpopPublicKey);
      cachedKeyPair = { privateKey, publicJwk };
      return cachedKeyPair;
    }
  }

  // No stored keys — generate new ones and store them
  // This happens when keys were lost or on first bootstrap
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  if (configId) {
    await prisma.hubstaffConfig.update({
      where: { id: configId },
      data: { dpopPrivateKey: privatePem, dpopPublicKey: JSON.stringify(publicJwk) },
    });
  }

  cachedKeyPair = { privateKey, publicJwk };
  return cachedKeyPair;
}

/** Clear in-memory DPoP cache (e.g. after token update stores new keys). */
export function clearDpopCache() {
  cachedKeyPair = null;
}

// --- DPoP Proof Generation ---

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function createDpopProof(
  keyPair: KeyPair,
  method: string,
  url: string,
  accessToken?: string
): string {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: keyPair.publicJwk,
  };

  const payload: Record<string, string | number> = {
    htm: method,
    htu: url,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID(),
  };

  // ath = BASE64URL(SHA256(access_token)) — required when Bearer token is present
  if (accessToken) {
    const hash = crypto.createHash("sha256").update(accessToken, "ascii").digest();
    payload.ath = base64url(hash);
  }

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const sigInput = `${headerB64}.${payloadB64}`;

  const sig = crypto.sign("sha256", Buffer.from(sigInput), keyPair.privateKey);
  const sigB64 = base64url(sig);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// --- Token Management ---

async function bootstrapFromEnv(): Promise<string> {
  const refreshToken = process.env.HUBSTAFF_REFRESH_TOKEN;
  const orgId = process.env.HUBSTAFF_ORG_ID;
  if (!refreshToken || !orgId) throw new Error("Missing HUBSTAFF_REFRESH_TOKEN or HUBSTAFF_ORG_ID");

  // Token endpoint is plain OAuth2 — NO DPoP
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hubstaff token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  // Generate DPoP key pair for subsequent API calls (not token exchange)
  const keyPair = await getDpopKeyPair();
  const privatePem = keyPair.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  await prisma.hubstaffConfig.create({
    data: {
      organizationId: orgId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
      dpopPrivateKey: privatePem,
      dpopPublicKey: JSON.stringify(keyPair.publicJwk),
    },
  });

  return data.access_token;
}

async function refreshAccessToken(config: { id: string; refreshToken: string; dpopPrivateKey?: string | null; dpopPublicKey?: string | null }): Promise<string> {
  // Token endpoint is plain OAuth2 — NO DPoP (DPoP is only for API calls)
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.refreshToken }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hubstaff token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  await prisma.hubstaffConfig.update({
    where: { id: config.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || config.refreshToken,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
    },
  });

  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const config = await prisma.hubstaffConfig.findFirst();
  if (!config) return bootstrapFromEnv();
  if (config.tokenExpiresAt > new Date(Date.now() + 60000)) return config.accessToken;
  return refreshAccessToken({
    id: config.id,
    refreshToken: config.refreshToken,
    dpopPrivateKey: config.dpopPrivateKey,
    dpopPublicKey: config.dpopPublicKey,
  });
}

// --- API Helpers ---

export async function hubstaffGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const config = await prisma.hubstaffConfig.findFirst();
  let token = await getAccessToken();
  const url = new URL(`${HUBSTAFF_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  // First attempt: plain Bearer (token obtained without DPoP binding)
  let res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If 401 with plain Bearer, try with DPoP (in case token IS DPoP-bound)
  if (res.status === 401 && config?.dpopPrivateKey && config?.dpopPublicKey) {
    console.log(`[Hubstaff] 401 on ${path} — retrying with DPoP proof`);
    const dpopUrl = `${url.origin}${url.pathname}`;
    const keyPair = await getDpopKeyPair(config.id);
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        DPoP: createDpopProof(keyPair, "GET", dpopUrl, token),
      },
    });
  }

  // If still 401, force refresh token and retry plain
  if (res.status === 401 && config) {
    console.log(`[Hubstaff] 401 on ${path} — force-refreshing token`);
    cachedKeyPair = null;
    token = await refreshAccessToken(config);
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hubstaff API ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

// --- Auto Org ID Helper ---

export async function getOrgId(): Promise<string> {
  const config = await prisma.hubstaffConfig.findFirst({ select: { organizationId: true } });
  if (config) return config.organizationId;
  const envOrgId = process.env.HUBSTAFF_ORG_ID;
  if (!envOrgId) throw new Error("No Hubstaff organization configured");
  return envOrgId;
}

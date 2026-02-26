import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

const HUBSTAFF_API = "https://api.hubstaff.com/v2";
const TOKEN_URL = "https://account.hubstaff.com/access_tokens";

// --- DPoP Key Management ---

type KeyPair = { privateKey: crypto.KeyObject; publicJwk: JsonWebKey };

let cachedKeyPair: KeyPair | null = null;

async function getDpopKeyPair(configId?: string): Promise<KeyPair> {
  if (cachedKeyPair) return cachedKeyPair;

  // Try loading from DB
  if (configId) {
    const config = await prisma.hubstaffConfig.findUnique({ where: { id: configId } });
    if (config?.dpopPrivateKey && config?.dpopPublicKey) {
      const privateKey = crypto.createPrivateKey(config.dpopPrivateKey);
      const publicJwk = JSON.parse(config.dpopPublicKey);
      cachedKeyPair = { privateKey, publicJwk };
      return cachedKeyPair;
    }
  }

  // Generate new EC P-256 key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  // Store in DB if we have a config
  if (configId) {
    await prisma.hubstaffConfig.update({
      where: { id: configId },
      data: { dpopPrivateKey: privatePem, dpopPublicKey: JSON.stringify(publicJwk) },
    });
  }

  cachedKeyPair = { privateKey, publicJwk };
  return cachedKeyPair;
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

  // Generate DPoP key pair before first token request
  const keyPair = await getDpopKeyPair();
  const dpopProof = createDpopProof(keyPair, "POST", TOKEN_URL);

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
    throw new Error(`Hubstaff token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
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

async function refreshAccessToken(config: { id: string; refreshToken: string }): Promise<string> {
  const keyPair = await getDpopKeyPair(config.id);
  const dpopProof = createDpopProof(keyPair, "POST", TOKEN_URL);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "DPoP": dpopProof,
    },
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
  return refreshAccessToken(config);
}

// --- API Helpers ---

async function hubstaffGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const config = await prisma.hubstaffConfig.findFirst();
  const token = await getAccessToken();
  const url = new URL(`${HUBSTAFF_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  // DPoP proof must use scheme+host+path only (no query/fragment)
  const dpopUrl = `${url.origin}${url.pathname}`;
  const keyPair = await getDpopKeyPair(config?.id);
  const dpopProof = createDpopProof(keyPair, "GET", dpopUrl, token);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      DPoP: dpopProof,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hubstaff API ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

// --- Public API Functions ---

export type HubstaffMember = {
  id: number;
  user_id: number;
  user: {
    id: number;
    name: string;
    email: string;
    status: string;
  };
};

export type HubstaffActivity = {
  id: number;
  user_id: number;
  starts_at: string;
  tracked: number; // seconds tracked in this activity
  overall: number;
  keyboard: number;
  mouse: number;
};

type MembersResponse = { members: HubstaffMember[] };
type ActivitiesResponse = { activities: HubstaffActivity[] };

export async function getOrganizationMembers(orgId: string): Promise<HubstaffMember[]> {
  const data = await hubstaffGet<MembersResponse>(`/organizations/${orgId}/members`, {
    page_limit: "100",
  });
  return data.members || [];
}

export async function getOrganizationActivities(
  orgId: string,
  startTime: string,
  stopTime: string
): Promise<HubstaffActivity[]> {
  const data = await hubstaffGet<ActivitiesResponse>(`/organizations/${orgId}/activities`, {
    "time_slot[start]": startTime,
    "time_slot[stop]": stopTime,
    page_limit: "500",
  });
  return data.activities || [];
}

export async function getConfig() {
  return prisma.hubstaffConfig.findFirst();
}

export async function updateLastSync() {
  const config = await prisma.hubstaffConfig.findFirst();
  if (config) {
    await prisma.hubstaffConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() },
    });
  }
}

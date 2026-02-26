import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

const HUBSTAFF_API = "https://api.hubstaff.com/v2";
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

async function hubstaffGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const config = await prisma.hubstaffConfig.findFirst();
  let token = await getAccessToken();
  const url = new URL(`${HUBSTAFF_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  // Use DPoP only if config has stored DPoP keys (token was DPoP-bound)
  const hasDpop = !!config?.dpopPrivateKey && !!config?.dpopPublicKey;
  const dpopUrl = `${url.origin}${url.pathname}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (hasDpop) {
    const keyPair = await getDpopKeyPair(config!.id);
    headers["DPoP"] = createDpopProof(keyPair, "GET", dpopUrl, token);
  }

  let res = await fetch(url.toString(), { headers });

  // Auto-recover from 401: force refresh token and retry once
  if (res.status === 401 && config) {
    console.log(`[Hubstaff] 401 on ${path} — force-refreshing token`);
    cachedKeyPair = null;
    token = await refreshAccessToken(config);
    const retryHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (hasDpop) {
      const keyPair = await getDpopKeyPair(config.id);
      retryHeaders["DPoP"] = createDpopProof(keyPair, "GET", dpopUrl, token);
    }
    res = await fetch(url.toString(), { headers: retryHeaders });
  }

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
  project_id?: number;
};

export type LastActivity = {
  last_client_activity: string;
  online: boolean;
  last_project_id: number | null;
  last_task_id: number | null;
  user_id: number;
};

export type AttendanceShift = {
  id: number;
  user_id: number;
  organization_id: number;
  attendance_schedule_id: number;
  date: string;
  start_time: string;
  duration: number;
  minimum_time: number;
  status: string; // ontime, early, late, abandoned, missed
  actual_start_time: string | null;
  actual_stop_time: string | null;
  actual_duration: number | null;
};

type MembersResponse = { members: HubstaffMember[] };
type ActivitiesResponse = { activities: HubstaffActivity[] };
type LastActivitiesResponse = { last_activities: LastActivity[] };
type AttendanceShiftsResponse = { attendance_shifts: AttendanceShift[] };

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

/** Get who's online right now — simpler than polling activities. orgId is auto-resolved if omitted. */
export async function getLastActivities(orgId?: string): Promise<LastActivity[]> {
  const resolvedOrgId = orgId || await getOrgId();
  const data = await hubstaffGet<LastActivitiesResponse>(`/organizations/${resolvedOrgId}/last_activities`, {
    page_limit: "100",
  });
  return data.last_activities || [];
}

/**
 * Get actual attendance shifts (clock-in/out records) for a date range.
 * Can be called as (orgId, startDate, stopDate) or (startDate, stopDate) with auto orgId.
 */
export async function getAttendanceShifts(
  orgIdOrStartDate: string,
  startOrStopDate: string,
  stopDate?: string,
): Promise<AttendanceShift[]> {
  let resolvedOrgId: string;
  let start: string;
  let stop: string;

  if (stopDate) {
    // Called as (orgId, startDate, stopDate)
    resolvedOrgId = orgIdOrStartDate;
    start = startOrStopDate;
    stop = stopDate;
  } else {
    // Called as (startDate, stopDate)
    resolvedOrgId = await getOrgId();
    start = orgIdOrStartDate;
    stop = startOrStopDate;
  }

  const data = await hubstaffGet<AttendanceShiftsResponse>(`/organizations/${resolvedOrgId}/attendance_shifts`, {
    "date[start]": start,
    "date[stop]": stop,
    page_limit: "500",
  });
  return data.attendance_shifts || [];
}

export async function getConfig() {
  return prisma.hubstaffConfig.findFirst();
}

// --- Auto Org ID Helper ---

async function getOrgId(): Promise<string> {
  const config = await prisma.hubstaffConfig.findFirst({ select: { organizationId: true } });
  if (config) return config.organizationId;
  const envOrgId = process.env.HUBSTAFF_ORG_ID;
  if (!envOrgId) throw new Error("No Hubstaff organization configured");
  return envOrgId;
}

// --- Convenience wrappers (auto-resolve org ID from DB) ---

/**
 * List org members with sideloaded user objects.
 * Returns { members, users } matching Hubstaff V2 response shape.
 */
export async function listMembers(): Promise<{ members: any[]; users: any[] }> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ members: any[]; users: any[] }>(
    `/organizations/${orgId}/members`,
    { page_limit: "100", include: "users" },
  );
  return { members: data.members || [], users: data.users || [] };
}

/** Get activity slots for a time range (10-min intervals). */
export async function getActivities(startTime: string, stopTime: string): Promise<HubstaffActivity[]> {
  const orgId = await getOrgId();
  return getOrganizationActivities(orgId, startTime, stopTime);
}

/** Get daily activity aggregates (one row per user per day). */
export async function getDailyActivities(startDate: string, stopDate: string): Promise<any[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ daily_activities: any[] }>(
    `/organizations/${orgId}/activities/daily`,
    { "date[start]": startDate, "date[stop]": stopDate, page_limit: "500" },
  );
  return data.daily_activities || [];
}

/** Get attendance schedules (expected shifts) for a date range. */
export async function getAttendanceSchedules(
  startDate: string,
  stopDate: string,
): Promise<{ schedules: any[]; users: any[] }> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<any>(
    `/organizations/${orgId}/attendance/schedules`,
    { "date[start]": startDate, "date[stop]": stopDate, page_limit: "500" },
  );
  return {
    schedules: data.attendance_schedules || data.schedules || [],
    users: data.users || [],
  };
}

/** Get all projects in the organization. */
export async function getProjects(): Promise<any[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ projects: any[] }>(
    `/organizations/${orgId}/projects`,
    { page_limit: "100" },
  );
  return data.projects || [];
}

// --- Screenshots ---

export type HubstaffScreenshot = {
  id: number;
  url: string;
  time_slot: string;
  recorded_at: string;
  user_id: number;
  project_id: number;
  task_id: number | null;
  activity_id: number;
  offset_x: number;
  offset_y: number;
  width: number;
  height: number;
  screen: number;
  created_at: string;
  updated_at: string;
};

/** Get screenshots for a time range. Max 7-day range. */
export async function getScreenshots(startTime: string, stopTime: string): Promise<HubstaffScreenshot[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ screenshots: HubstaffScreenshot[] }>(
    `/organizations/${orgId}/screenshots`,
    { "time_slot[start]": startTime, "time_slot[stop]": stopTime, page_limit: "500" },
  );
  return data.screenshots || [];
}

// --- App / Tool Usage ---

export type ToolUsage = {
  id: number;
  user_id: number;
  project_id: number;
  task_id: number | null;
  name: string;
  tracked: number; // seconds spent in this app
  time_slot: string;
  created_at: string;
  updated_at: string;
};

/** Get app/tool usage for a time range (which apps chatters are using). Max 7-day range. */
export async function getToolUsages(startTime: string, stopTime: string): Promise<ToolUsage[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ tool_usages: ToolUsage[] }>(
    `/organizations/${orgId}/tool_usages`,
    { "time_slot[start]": startTime, "time_slot[stop]": stopTime, page_limit: "500" },
  );
  return data.tool_usages || [];
}

/** Get daily aggregated app/tool usage. Max 31-day range. */
export async function getDailyToolUsages(startDate: string, stopDate: string): Promise<ToolUsage[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ daily_tool_usages: ToolUsage[] }>(
    `/organizations/${orgId}/tool_usages/daily`,
    { "date[start]": startDate, "date[stop]": stopDate, page_limit: "500" },
  );
  return data.daily_tool_usages || [];
}

// --- Unusual Activity Detection ---

export type UnusualActivity = {
  id: number;
  user_id: number;
  activity_id: number;
  classification: string; // "slightly_unusual" | "unusual" | "highly_unusual"
  starts_at: string;
  duration: number; // seconds
  overall: number; // activity %
  mouse: number;
  keyboard: number;
  screenshots_count: number;
  top_apps: string[];
  created_at: string;
};

/** Get unusual/suspicious activity flags. */
export async function getUnusualActivities(startDate: string, stopDate: string): Promise<UnusualActivity[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ unusual_activities: UnusualActivity[] }>(
    `/organizations/${orgId}/insights/unusual_activities`,
    { "date[start]": startDate, "date[stop]": stopDate, page_limit: "500" },
  );
  return data.unusual_activities || [];
}

// --- Teams ---

export type HubstaffTeam = {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  created_at: string;
};

/** Get all teams in the organization. */
export async function getTeams(): Promise<HubstaffTeam[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ teams: HubstaffTeam[] }>(
    `/organizations/${orgId}/teams`,
    { page_limit: "100" },
  );
  return data.teams || [];
}

// --- Time Edit Logs (audit trail) ---

/** Get manual time modifications (for detecting gaming). */
export async function getTimeEditLogs(startDate: string, stopDate: string): Promise<any[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ time_edit_logs: any[] }>(
    `/organizations/${orgId}/time_edit_logs`,
    { "date[start]": startDate, "date[stop]": stopDate, page_limit: "500" },
  );
  return data.time_edit_logs || [];
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

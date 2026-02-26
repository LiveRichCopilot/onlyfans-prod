import { prisma } from "@/lib/prisma";
const HUBSTAFF_API = "https://api.hubstaff.com/v2";
const TOKEN_URL = "https://account.hubstaff.com/access_tokens";

// --- Token Management ---

async function bootstrapFromEnv(): Promise<string> {
  const refreshToken = process.env.HUBSTAFF_REFRESH_TOKEN;
  const orgId = process.env.HUBSTAFF_ORG_ID;
  if (!refreshToken || !orgId) throw new Error("Missing HUBSTAFF_REFRESH_TOKEN or HUBSTAFF_ORG_ID");

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

  await prisma.hubstaffConfig.create({
    data: {
      organizationId: orgId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
    },
  });

  return data.access_token;
}

async function refreshAccessToken(config: { id: string; refreshToken: string }): Promise<string> {
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
  return refreshAccessToken(config);
}

// --- API Helpers ---

async function hubstaffGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${HUBSTAFF_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
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

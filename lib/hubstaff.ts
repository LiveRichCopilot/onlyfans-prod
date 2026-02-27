import { prisma } from "@/lib/prisma";
import { hubstaffGet, getOrgId } from "@/lib/hubstaff-auth";

// Re-export auth helpers so existing imports from "@/lib/hubstaff" keep working
export { getAccessToken, clearDpopCache } from "@/lib/hubstaff-auth";

// --- Public Type Definitions ---

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

// --- Organization Members & Activities ---

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
  thumb_url: string;
  time_slot: string;
  recorded_at: string;
  user_id: number;
  project_id: number;
  offset_x: number;
  offset_y: number;
  width: number;
  height: number;
  screen: number;
  created_at: string;
  updated_at: string;
};

type RawHubstaffScreenshot = Omit<HubstaffScreenshot, "url" | "thumb_url"> & {
  full_url: string;
  thumb_url: string;
};

/** Get screenshots for a time range. Max 7-day range. */
export async function getScreenshots(startTime: string, stopTime: string): Promise<HubstaffScreenshot[]> {
  const orgId = await getOrgId();
  const data = await hubstaffGet<{ screenshots: RawHubstaffScreenshot[] }>(
    `/organizations/${orgId}/screenshots`,
    { "time_slot[start]": startTime, "time_slot[stop]": stopTime, page_limit: "500" },
  );
  // Hubstaff V2 API uses "full_url" not "url" — normalize to "url"
  return (data.screenshots || []).map((s) => ({
    ...s,
    url: s.full_url,
    thumb_url: s.thumb_url,
  }));
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

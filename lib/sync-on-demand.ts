import { prisma } from "@/lib/prisma";

/**
 * On-demand sync — replaces 24/7 cron jobs.
 * Checks when data was last synced for a creator.
 * If stale, fires off a background sync to the cron endpoint.
 * Page routes call this fire-and-forget so users see instant DB data
 * while fresh OFAPI data loads in the background for next view.
 */

const STALE_THRESHOLDS: Record<string, number> = {
  chat_messages: 5 * 60_000,    // 5 min — webhooks fill most gaps
  transactions: 15 * 60_000,    // 15 min
  fans: 15 * 60_000,            // 15 min
  content: 15 * 60_000,         // 15 min
  engagement_dm: 30 * 60_000,   // 30 min
  engagement_mass: 30 * 60_000, // 30 min
  mass_reply: 30 * 60_000,      // 30 min
  chargebacks: 60 * 60_000,     // 1 hour
  online: 5 * 60_000,           // 5 min
};

const CRON_PATHS: Record<string, string> = {
  chat_messages: "/api/cron/sync-messages",
  transactions: "/api/cron/sync-transactions",
  content: "/api/cron/sync-outbound-content",
  engagement_dm: "/api/cron/sync-dm-engagement",
  engagement_mass: "/api/cron/sync-mass-message-stats",
  mass_reply: "/api/cron/mass-reply-attribution",
  chargebacks: "/api/cron/sync-chargebacks",
  online: "/api/cron/online-poll",
};

function getBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/** Check if a data type is stale for a specific creator */
async function isStale(creatorId: string, dataType: string): Promise<boolean> {
  const threshold = STALE_THRESHOLDS[dataType] || 300_000;
  const cursor = await prisma.syncCursor.findFirst({
    where: { creatorId, dataType },
    orderBy: { lastSyncAt: "desc" },
    select: { lastSyncAt: true },
  });
  if (!cursor?.lastSyncAt) return true;
  return Date.now() - cursor.lastSyncAt.getTime() > threshold;
}

/** Fire-and-forget trigger to a cron endpoint for a single creator */
function fireCronSync(dataType: string, creatorId: string) {
  const path = CRON_PATHS[dataType];
  if (!path) return;
  const base = getBaseUrl();
  const secret = process.env.CRON_SECRET || "";
  fetch(`${base}${path}?creatorId=${creatorId}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(50_000),
  }).catch(() => {});
}

/**
 * Check staleness and trigger background sync if needed.
 * Call this from page API routes — it returns immediately.
 *
 * Usage:
 *   syncIfStale(creatorId, "chat_messages", "transactions");
 */
export async function syncIfStale(creatorId: string, ...dataTypes: string[]) {
  for (const dt of dataTypes) {
    const stale = await isStale(creatorId, dt);
    if (stale) fireCronSync(dt, creatorId);
  }
}

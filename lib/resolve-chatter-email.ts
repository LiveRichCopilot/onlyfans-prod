import { prisma } from "@/lib/prisma";

// In-memory cache to avoid hitting DB on every call (refreshes every 60s)
let aliasCache: Map<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/** Normalize email: lowercase, trim, strip Gmail +tags */
export function normalizeEmail(raw: string): string {
  const e = raw.trim().toLowerCase();
  const [local, domain] = e.split("@");
  if (domain === "gmail.com" && local) {
    return `${local.split("+")[0]}@${domain}`;
  }
  return e;
}

async function loadCache(): Promise<Map<string, string>> {
  const now = Date.now();
  if (aliasCache && now - cacheTime < CACHE_TTL) return aliasCache;

  const aliases = await prisma.chatterAlias.findMany();
  const map = new Map<string, string>();
  for (const a of aliases) {
    map.set(normalizeEmail(a.aliasEmail), normalizeEmail(a.canonicalEmail));
  }
  aliasCache = map;
  cacheTime = now;
  return map;
}

/** Resolve an email through the alias table. Returns canonical email (lowercased). */
export async function resolveEmail(email?: string | null): Promise<string> {
  if (!email) return "";
  const e = normalizeEmail(email);
  if (!e) return "";
  const cache = await loadCache();
  return cache.get(e) ?? e;
}

/** Resolve multiple emails at once (batch, same cache hit). */
export async function resolveEmails(emails: string[]): Promise<Map<string, string>> {
  const cache = await loadCache();
  const result = new Map<string, string>();
  for (const email of emails) {
    const e = normalizeEmail(email);
    result.set(e, cache.get(e) ?? e);
  }
  return result;
}

/** Bust the cache (call after adding/removing aliases). */
export function clearAliasCache() {
  aliasCache = null;
  cacheTime = 0;
}

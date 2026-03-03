import { prisma } from "@/lib/prisma";
import { getDirectMessageStats, getMassMessageStats } from "@/lib/ofapi-engagement";
import { getEarningsByType } from "@/lib/ofapi-analytics";

/** Raw message from OFAPI with timestamp — attributable per-chatter */
export type RawMessage = {
  id: string;
  date: string;
  price: number;
  purchasedCount: number;
  viewedCount: number;
  sentCount: number;
  text: string;
  mediaCount: number;
  creatorId: string;
  source: "direct" | "mass";
};

/** Aggregated earnings per creator (NOT per-chatter attributable) */
export type CreatorEarnings = { tips: number; total: number };

export type FetchResult = {
  messages: RawMessage[];
  creatorEarnings: Map<string, CreatorEarnings>;
  creators: { id: string; name: string | null; ofapiCreatorId: string; ofapiToken: string }[];
};

function formatDateForApi(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

const PAGE_SIZE = 100;
const MAX_ITEMS = 2000; // Safety cap per source per creator

/** Paginate through all messages using OFAPI cursor (_pagination.next_page) */
async function fetchAllPages(
  account: string, token: string,
  fetcher: (account: string, token: string, start: Date, end: Date, limit: number, offset: number) => Promise<unknown>,
  startDate: Date, endDate: Date,
  requestStart: number,
): Promise<any[]> {
  const allItems: any[] = [];

  // First page via our wrapper
  const firstRes = await fetcher(account, token, startDate, endDate, PAGE_SIZE, 0).catch(() => null) as any;
  if (!firstRes) return allItems;

  const firstItems = firstRes?.data?.items || firstRes?.items || [];
  allItems.push(...firstItems);

  // Follow _pagination.next_page cursor (check both top-level and _meta paths)
  let nextPage: string | null =
    firstRes?._pagination?.next_page ??
    firstRes?._meta?._pagination?.next_page ??
    firstRes?.data?._pagination?.next_page ?? null;

  // Resolve token for raw fetch (same logic as ofapi-core)
  const resolvedToken = token === "linked_via_auth_module"
    ? (process.env.OFAPI_API_KEY || process.env.TEST_OFAPI_KEY || "")
    : token;

  while (nextPage && allItems.length < MAX_ITEMS && Date.now() - requestStart < 45000) {
    const r = await fetch(nextPage, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resolvedToken}`,
      },
    }).catch(() => null);
    if (!r || !r.ok) break;

    const nextData = await r.json().catch(() => null);
    if (!nextData) break;

    const nextItems = nextData?.data?.items || nextData?.items || [];
    if (nextItems.length === 0) break;

    allItems.push(...nextItems);
    nextPage =
      nextData?._pagination?.next_page ??
      nextData?._meta?._pagination?.next_page ??
      nextData?.data?._pagination?.next_page ?? null;
  }

  return allItems;
}

/** Fetch all OFAPI engagement data for creators in the date range */
export async function fetchOfapiData(
  startDate: Date,
  endDate: Date,
  creatorId: string | null,
): Promise<FetchResult> {
  const creatorWhere: Record<string, unknown> = { active: true, ofapiToken: { not: null } };
  if (creatorId) creatorWhere.id = creatorId;

  const allCreators = await prisma.creator.findMany({
    where: creatorWhere,
    select: { id: true, name: true, ofapiCreatorId: true, ofapiToken: true },
  });

  const creators = allCreators.filter(c => c.ofapiToken && c.ofapiCreatorId) as FetchResult["creators"];

  const messages: RawMessage[] = [];
  const creatorEarnings = new Map<string, CreatorEarnings>();
  const batchSize = 3; // Smaller batches since each creator now paginates
  const requestStart = Date.now();
  const startStr = formatDateForApi(startDate);
  const endStr = formatDateForApi(endDate);

  for (let i = 0; i < creators.length; i += batchSize) {
    if (Date.now() - requestStart > 45000) break;

    const batch = creators.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (c) => {
      const [directItems, massItems, tipsRes, totalRes] = await Promise.all([
        fetchAllPages(c.ofapiCreatorId, c.ofapiToken, getDirectMessageStats, startDate, endDate, requestStart),
        fetchAllPages(c.ofapiCreatorId, c.ofapiToken, getMassMessageStats, startDate, endDate, requestStart),
        getEarningsByType(c.ofapiCreatorId, c.ofapiToken, "tips", startStr, endStr).catch(() => null),
        getEarningsByType(c.ofapiCreatorId, c.ofapiToken, "total", startStr, endStr).catch(() => null),
      ]);
      return { creator: c, directItems, massItems, tipsRes, totalRes };
    }));

    for (const r of results) {
      for (const item of r.directItems) {
        messages.push(parseMessage(item, r.creator.id, "direct"));
      }
      for (const item of r.massItems) {
        messages.push(parseMessage(item, r.creator.id, "mass"));
      }

      const tips = Number((r.tipsRes as any)?.data?.total ?? (r.tipsRes as any)?.total ?? 0);
      const total = Number((r.totalRes as any)?.data?.total ?? (r.totalRes as any)?.total ?? 0);
      creatorEarnings.set(r.creator.id, { tips, total });
    }
  }

  // Deduplicate messages by ID (OFAPI can return the same message in both direct + mass)
  const seen = new Set<string>();
  const deduped: RawMessage[] = [];
  for (const msg of messages) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      deduped.push(msg);
    }
  }

  if (deduped.length !== messages.length) {
    console.log(`[chatter-perf] Deduped ${messages.length} → ${deduped.length} messages (${messages.length - deduped.length} duplicates removed)`);
  }

  // Log revenue diagnostics
  const totalRev = deduped.reduce((s, m) => s + m.purchasedCount * m.price, 0);
  console.log(`[chatter-perf] ${deduped.length} messages, gross revenue: $${totalRev.toFixed(2)}, creators: ${creators.length}`);
  if (deduped[0]) {
    const s = deduped[0];
    console.log(`[chatter-perf] sample msg: id=${s.id} price=${s.price} (${typeof s.price}) purchased=${s.purchasedCount} (${typeof s.purchasedCount}) source=${s.source}`);
  }

  return { messages: deduped, creatorEarnings, creators };
}

function parseMessage(item: any, creatorId: string, source: "direct" | "mass"): RawMessage {
  return {
    id: String(item.id || item.messageId || Math.random()),
    date: item.date || item.createdAt || "",
    price: Number(item.price ?? 0),
    purchasedCount: Number(item.purchasedCount ?? 0),
    viewedCount: Number(item.viewedCount ?? 0),
    sentCount: Number(item.sentCount ?? (source === "direct" ? 1 : 0)),
    text: item.rawText || item.text || "",
    mediaCount: Number(item.mediaCount ?? 0),
    creatorId,
    source,
  };
}

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
  const batchSize = 5;
  const requestStart = Date.now();
  const startStr = formatDateForApi(startDate);
  const endStr = formatDateForApi(endDate);

  for (let i = 0; i < creators.length; i += batchSize) {
    if (Date.now() - requestStart > 40000) break;

    const batch = creators.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (c) => {
      const [directRes, massRes, tipsRes, totalRes] = await Promise.all([
        getDirectMessageStats(c.ofapiCreatorId, c.ofapiToken, startDate, endDate, 50, 0).catch(() => null),
        getMassMessageStats(c.ofapiCreatorId, c.ofapiToken, startDate, endDate, 50, 0).catch(() => null),
        getEarningsByType(c.ofapiCreatorId, c.ofapiToken, "tips", startStr, endStr).catch(() => null),
        getEarningsByType(c.ofapiCreatorId, c.ofapiToken, "total", startStr, endStr).catch(() => null),
      ]);
      return { creator: c, directRes, massRes, tipsRes, totalRes };
    }));

    for (const r of results) {
      const directItems = (r.directRes as any)?.data?.items || (r.directRes as any)?.items || [];
      for (const item of directItems) {
        messages.push(parseMessage(item, r.creator.id, "direct"));
      }

      const massItems = (r.massRes as any)?.data?.items || (r.massRes as any)?.items || [];
      for (const item of massItems) {
        messages.push(parseMessage(item, r.creator.id, "mass"));
      }

      const tips = (r.tipsRes as any)?.data?.total || (r.tipsRes as any)?.total || 0;
      const total = (r.totalRes as any)?.data?.total || (r.totalRes as any)?.total || 0;
      creatorEarnings.set(r.creator.id, {
        tips: typeof tips === "number" ? tips : 0,
        total: typeof total === "number" ? total : 0,
      });
    }
  }

  return { messages, creatorEarnings, creators };
}

function parseMessage(item: any, creatorId: string, source: "direct" | "mass"): RawMessage {
  return {
    id: String(item.id || item.messageId || Math.random()),
    date: item.date || item.createdAt || "",
    price: item.price || 0,
    purchasedCount: item.purchasedCount || 0,
    viewedCount: item.viewedCount || 0,
    sentCount: item.sentCount || (source === "direct" ? 1 : 0),
    text: item.rawText || item.text || "",
    mediaCount: item.mediaCount || 0,
    creatorId,
    source,
  };
}

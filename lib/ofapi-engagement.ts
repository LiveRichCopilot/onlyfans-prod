import { ofapiRequest } from "./ofapi-core";

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

// ─── Internal page fetchers ─────────────────────────────────────────

async function fetchItemsPage(path: string, apiKey: string) {
  const raw = await ofapiRequest(path, apiKey, { timeoutMs: 10000 });
  return {
    items: raw?.data?.items ?? [],
    hasMore: !!raw?.data?.hasMore,
    nextPage: raw?._pagination?.next_page as string | undefined,
    raw,
  };
}

async function fetchListPage(path: string, apiKey: string) {
  const raw = await ofapiRequest(path, apiKey, { timeoutMs: 10000 });
  return {
    list: raw?.data?.list ?? raw?.data ?? [],
    hasMore: !!raw?.data?.hasMore,
    marker: raw?.data?.marker,
    raw,
  };
}

// ─── Get-all functions (auto-paginate, exported) ────────────────────

/** Fetch ALL direct message stats (follows _pagination.next_page) */
export async function getAllDirectMessageStats(
  account: string, apiKey: string,
  params: { startDate: Date; endDate: Date; limit?: number },
  opts?: { maxPages?: number },
): Promise<any[]> {
  const limit = params.limit || 50;
  const s = encodeURIComponent(formatDate(params.startDate));
  const e = encodeURIComponent(formatDate(params.endDate));
  let path: string | undefined = `/api/${account}/engagement/messages/direct-messages?startDate=${s}&endDate=${e}&limit=${limit}`;
  const all: any[] = [];
  let pages = 0;
  const max = opts?.maxPages || 20;

  while (path && pages < max) {
    const page = await fetchItemsPage(path, apiKey);
    all.push(...page.items);
    pages++;
    path = page.hasMore && page.nextPage ? page.nextPage : undefined;
  }
  return all;
}

/** Fetch ALL mass message stats (follows _pagination.next_page) */
export async function getAllMassMessageStats(
  account: string, apiKey: string,
  params: { startDate: Date; endDate: Date; limit?: number },
  opts?: { maxPages?: number },
): Promise<any[]> {
  const limit = params.limit || 50;
  const s = encodeURIComponent(formatDate(params.startDate));
  const e = encodeURIComponent(formatDate(params.endDate));
  let path: string | undefined = `/api/${account}/engagement/messages/mass-messages?startDate=${s}&endDate=${e}&limit=${limit}`;
  const all: any[] = [];
  let pages = 0;
  const max = opts?.maxPages || 20;

  while (path && pages < max) {
    const page = await fetchItemsPage(path, apiKey);
    all.push(...page.items);
    pages++;
    path = page.hasMore && page.nextPage ? page.nextPage : undefined;
  }
  return all;
}

/** Fetch ALL buyers for a message (offset + hasMore pagination) */
export async function getAllMessageBuyers(
  account: string, apiKey: string, messageId: string,
  opts?: { limit?: number; maxPages?: number },
): Promise<any[]> {
  const limit = opts?.limit || 50;
  const max = opts?.maxPages || 20;
  const all: any[] = [];
  let offset = 0;
  let pages = 0;

  while (pages < max) {
    const path = `/api/${account}/engagement/messages/${messageId}/buyers?limit=${limit}&offset=${offset}&skip_users_dups=1`;
    const page = await fetchListPage(path, apiKey);
    all.push(...page.list);
    pages++;
    if (!page.hasMore || page.list.length === 0) break;
    offset += page.list.length;
  }
  return all;
}

// ─── Non-paginated endpoints ────────────────────────────────────────

/** Mass message chart — time series of sent count + purchase revenue */
export async function getMassMessageChartData(
  account: string, apiKey: string, startDate: Date, endDate: Date,
) {
  const s = encodeURIComponent(formatDate(startDate));
  const e = encodeURIComponent(formatDate(endDate));
  return ofapiRequest(
    `/api/${account}/engagement/messages/mass-messages/chart?startDate=${s}&endDate=${e}`,
    apiKey, { timeoutMs: 8000 },
  );
}

/** Best performing message by purchases */
export async function getTopMessage(account: string, apiKey: string) {
  return ofapiRequest(`/api/${account}/engagement/messages/top-message`, apiKey, { timeoutMs: 10000 });
}

// ─── Legacy single-page exports (backward compat for existing crons) ─

export async function getDirectMessageStats(
  account: string, apiKey: string, startDate: Date, endDate: Date, limit = 50, offset = 0,
) {
  const s = encodeURIComponent(formatDate(startDate));
  const e = encodeURIComponent(formatDate(endDate));
  return ofapiRequest(
    `/api/${account}/engagement/messages/direct-messages?startDate=${s}&endDate=${e}&limit=${limit}&offset=${offset}`,
    apiKey, { timeoutMs: 8000 },
  );
}

export async function getMassMessageStats(
  account: string, apiKey: string, startDate: Date, endDate: Date, limit = 50, offset = 0,
) {
  const s = encodeURIComponent(formatDate(startDate));
  const e = encodeURIComponent(formatDate(endDate));
  return ofapiRequest(
    `/api/${account}/engagement/messages/mass-messages?startDate=${s}&endDate=${e}&limit=${limit}&offset=${offset}`,
    apiKey, { timeoutMs: 8000 },
  );
}

export async function getMessageBuyers(account: string, apiKey: string, messageId: string) {
  return ofapiRequest(`/api/${account}/engagement/messages/${messageId}/buyers`, apiKey, { timeoutMs: 10000 });
}

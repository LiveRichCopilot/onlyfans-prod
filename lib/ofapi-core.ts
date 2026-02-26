// Real endpoints based on documentation

const OFAPI_BASE = "https://app.onlyfansapi.com";

type RequestOptions = {
    method?: string;
    body?: any;
    targetAccountId?: string;
    timeoutMs?: number;
};

export async function ofapiRequest(endpoint: string, apiKey: string, options: RequestOptions = {}) {
    const url = `${OFAPI_BASE}${endpoint}`;

    // Resolve abstract database placeholder tokens to actual environment keys
    let resolvedKey = apiKey;
    if (apiKey === "linked_via_auth_module") {
        resolvedKey = process.env.OFAPI_API_KEY || process.env.TEST_OFAPI_KEY || "";
    }

    const headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resolvedKey}`,
    };

    if (options.targetAccountId) {
        headers["X-Account-Id"] = options.targetAccountId;
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 5000; // 5s default per-call timeout
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(options.targetAccountId ? `${url}?accountId=${options.targetAccountId}` : url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
        const err = await response.text();
        console.error(`OFAPI Error: ${response.status} at ${endpoint}`, err);
        throw new Error(`OFAPI Request failed: ${response.status}`);
    }

    return response.json();
}

export { OFAPI_BASE };

/**
 * Fetch creator profile info
 */
export async function getProfile(username: string, apiKey: string) {
    return ofapiRequest(`/api/profiles/${username}`, apiKey);
}

/**
 * Fetch transactions incrementally
 */
export async function getTransactions(account: string, apiKey: string, filterType?: string, limit: number = 100, marker?: string) {
    let endpoint = `/api/${account}/transactions?limit=${Math.min(limit, 100)}`;
    if (filterType) endpoint += `&type=${filterType}`;
    if (marker) endpoint += `&marker=${marker}`;
    return ofapiRequest(endpoint, apiKey);
}

/**
 * Automatically paginates through transactions until it hits the target timestamp boundary.
 */
export async function fetchAllTransactions(account: string, apiKey: string, startWindow: Date, absoluteMax: number = 5000) {
    let allTxs: any[] = [];
    let marker: string | undefined = undefined;
    let hasMore = true;

    while (hasMore && allTxs.length < absoluteMax) {
        const res: any = await getTransactions(account, apiKey, undefined, 100, marker).catch(() => null);
        if (!res || (!res.data && !res.list)) break;

        const txs = res.data?.list || res.list || res.transactions || [];
        if (txs.length === 0) break;

        allTxs.push(...txs);

        const oldestDate = new Date(txs[txs.length - 1].createdAt);
        if (oldestDate < startWindow) break;

        hasMore = res.data?.hasMore ?? res.hasMore ?? false;
        marker = res.data?.nextMarker ?? res.nextMarker;
        if (!marker) break;
    }

    return allTxs;
}

/**
 * Fetch Authentic Creator Profile — GET /api/{account}/me
 */
export async function getMe(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/me`, apiKey);
}

/**
 * Fetch Fan details / all active fans — GET /api/{account}/fans/active
 */
export async function getActiveFans(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/fans/active`, apiKey);
}

/**
 * List ALL fans (active + expired) with optional spend + online filters
 */
export async function listAllFans(
    account: string,
    apiKey: string,
    options?: { minSpend?: number; maxSpend?: number; online?: boolean; limit?: number; offset?: number }
) {
    const params = new URLSearchParams();
    const defaultLimit = options?.online ? 20 : 50;
    params.set("limit", String(options?.limit || defaultLimit));
    params.set("offset", String(options?.offset || 0));
    if (options?.minSpend !== undefined) params.set("filter.total_spent", String(options.minSpend));
    if (options?.online !== undefined) params.set("filter.online", options.online ? "1" : "0");
    return ofapiRequest(`/api/${account}/fans/all?${params.toString()}`, apiKey);
}

/**
 * Get a quick overview of all unread notification types
 */
export async function getNotificationCounts(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/notifications/counts`, apiKey);
}

/**
 * UTILITY: Calculate top spending fans from a raw transaction array.
 */
export function calculateTopFans(transactions: any[], threshold: number = 0) {
    if (!transactions || !Array.isArray(transactions)) return [];

    const fanTotals: Record<string, { username: string; name: string; spend: number }> = {};

    transactions.forEach(tx => {
        if (!tx.user || !tx.user.username) return;
        const fanId = tx.user.id;
        const amount = Number(tx.amount) || 0;
        if (!fanTotals[fanId]) {
            fanTotals[fanId] = { username: tx.user.username, name: tx.user.name || tx.user.displayName || "Unknown", spend: 0 };
        }
        fanTotals[fanId].spend += amount;
    });

    return Object.values(fanTotals)
        .filter(fan => fan.spend >= threshold)
        .sort((a, b) => b.spend - a.spend);
}

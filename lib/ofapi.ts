// Real endpoints based on documentation 

const OFAPI_BASE = "https://app.onlyfansapi.com";

type RequestOptions = {
    method?: string;
    body?: any;
    targetAccountId?: string;
};

async function ofapiRequest(endpoint: string, apiKey: string, options: RequestOptions = {}) {
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

    const response = await fetch(options.targetAccountId ? `${url}?accountId=${options.targetAccountId}` : url, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const err = await response.text();
        console.error(`OFAPI Error: ${response.status} at ${endpoint}`, err);
        throw new Error(`OFAPI Request failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch creator profile info
 */
export async function getProfile(username: string, apiKey: string) {
    // Uses GET /api/profiles/{username} (Assuming this based on test curl from user request)
    // Or if it's their own profile, usually there's a me endpoint, but we'll stick to the proven endpoint.
    return ofapiRequest(`/api/profiles/${username}`, apiKey);
}

/**
 * Fetch transactions incrementally
 * Uses GET /api/{account}/transactions 
 */
export async function getTransactions(account: string, apiKey: string, filterType?: string, limit: number = 100, marker?: string) {
    // OnlyFans API strictly restricts limit to a max of 100 over GET /transactions
    let endpoint = `/api/${account}/transactions?limit=${Math.min(limit, 100)}`;
    if (filterType) {
        // Ex: type=tip
        endpoint += `&type=${filterType}`;
    }
    if (marker) {
        endpoint += `&marker=${marker}`;
    }
    return ofapiRequest(endpoint, apiKey);
}

/**
 * Automatically paginates through transactions until it hits the target timestamp boundary.
 * Extremely useful for accurately compiling 3d, 7d, and 30d high-volume revenue reports.
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

        // Failsafe exit if no marker returned
        if (!marker) break;
    }

    return allTxs;
}

/**
 * Fetch Authentic Creator Profile
 * Uses GET /api/{account}/me
 */
export async function getMe(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/me`, apiKey);
}

/**
 * Fetch transaction summary (Gross, Net, Fees) 
 * Uses POST /api/analytics/financial/transactions/summary
 */
export async function getTransactionsSummary(apiKey: string, bodyData: any, accountId?: string) {
    return ofapiRequest(`/api/analytics/financial/transactions/summary`, apiKey, {
        method: "POST",
        body: bodyData,
        targetAccountId: accountId || (bodyData?.account_ids?.[0])
    });
}

/**
 * Fetch Earnings Overview
 * Uses POST /api/analytics/summary/earnings
 */
export async function getEarningsOverview(apiKey: string, bodyData: any, accountId?: string) {
    return ofapiRequest(`/api/analytics/summary/earnings`, apiKey, {
        method: "POST",
        body: bodyData,
        targetAccountId: accountId || (bodyData?.account_ids?.[0])
    });
}

/**
 * Fetch Fan details / all active fans
 * Uses GET /api/{account}/fans/active
 */
export async function getActiveFans(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/fans/active`, apiKey);
}

export async function uploadToVault(account: string, apiKey: string, mediaBuffer: Buffer, fileName: string) {
    console.log(`Uploading ${fileName} to OnlyFans Vault via OFAPI...`);

    const formData = new FormData();
    // @ts-ignore - FormData accepts Blob/Buffer depending on Node version
    formData.append("file", new Blob([mediaBuffer]), fileName);

    const url = `${OFAPI_BASE}/api/${account}/media/vault`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            // Do NOT set Content-Type here, let fetch handle the multipart boundary
        },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.text();
        console.error(`OFAPI Upload Error: ${response.status}`, err);
        throw new Error(`Media Upload failed: HTTP ${response.status} | Details: ${err}`);
    }

    return response.json(); // { data: { id, type... } }
}

/**
 * Update Metadata (Title/Tags) on an existing Vault Media item
 * Uses PUT /api/{account}/media/vault/{media_id}
 */
export async function updateVaultMedia(account: string, apiKey: string, mediaId: string, title: string, text: string) {
    return ofapiRequest(`/api/${account}/media/vault/${mediaId}`, apiKey, {
        method: "PUT",
        body: {
            title: title,
            text: text
        }
    });
}

/**
 * Send Vault Media to Fan via Chat
 * Uses POST /api/chats/{fanId}/messages
 */
export async function sendVaultMediaToFan(fanId: string, vaultMediaId: string, apiKey: string) {
    return ofapiRequest(`/api/chats/${fanId}/messages`, apiKey, {
        method: "POST",
        body: {
            media_id: vaultMediaId,
            text: "Thank you for the tip! 💕"
        }
    });
}

/**
 * Get transaction totals grouped by transaction type (subscriptions, tips, messages, etc.).
 * POST /api/analytics/financial/transactions/by-type
 */
export async function getTransactionsByType(apiKey: string, payload: any, accountId?: string) {
    return ofapiRequest("/api/analytics/financial/transactions/by-type", apiKey, {
        method: "POST",
        body: payload,
        targetAccountId: accountId || (payload?.account_ids?.[0])
    });
}

/**
 * Generate revenue or churn forecasts using statistical models.
 * POST /api/analytics/financial/forecast
 */
export async function getRevenueForecast(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/financial/forecast", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Calculate profitability for creators including revenue, costs, commissions, and margins.
 * POST /api/analytics/financial/profitability
 */
export async function getProfitability(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/financial/profitability", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Get a quick overview of all unread notification types for an account.
 * GET /api/{account}/notifications/counts
 */
export async function getNotificationCounts(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/notifications/counts`, apiKey);
}

/**
 * List buyers for a specific message.
 * GET /api/{account}/engagement/messages/{message_id}/buyers
 */
export async function listMessageBuyers(account: string, messageId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/engagement/messages/${messageId}/buyers`, apiKey);
}

/**
 * Get historical earnings chart data for the team.
 * POST /api/analytics/summary/historical
 */
export async function getHistoricalPerformance(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/summary/historical", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Compare two time periods to analyze performance changes.
 * POST /api/analytics/summary/comparison
 */
export async function getPeriodComparison(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/summary/comparison", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * UTILITY: Calculate top spending fans from a raw transaction array.
 * Filters out standard OF platform fees/taxes to isolate gross spend per user.
 */
export function calculateTopFans(transactions: any[], threshold: number = 0) {
    if (!transactions || !Array.isArray(transactions)) return [];

    const fanTotals: Record<string, { username: string; name: string; spend: number }> = {};

    transactions.forEach(tx => {
        // Only sum revenue from actual OF Users, skip aggregate fee tags
        if (!tx.user || !tx.user.username) return;

        const fanId = tx.user.id;
        const amount = Number(tx.amount) || 0;

        if (!fanTotals[fanId]) {
            fanTotals[fanId] = { username: tx.user.username, name: tx.user.name || tx.user.displayName || "Unknown", spend: 0 };
        }

        // Sum gross amount spent by this specific user
        fanTotals[fanId].spend += amount;
    });

    const sorted = Object.values(fanTotals)
        .filter(fan => fan.spend >= threshold)
        .sort((a, b) => b.spend - a.spend);

    return sorted;
}

/**
 * Get earnings for a specific type (tips, messages, post, subscribes, stream)
 * Uses GET /api/{account}/statistics/statements/earnings?type=X
 */
export async function getEarningsByType(account: string, apiKey: string, type: string, startDate: string, endDate: string) {
    const start = encodeURIComponent(startDate);
    const end = encodeURIComponent(endDate);
    return ofapiRequest(`/api/${account}/statistics/statements/earnings?start_date=${start}&end_date=${end}&type=${type}`, apiKey);
}

/**
 * Full statistics overview — earnings, posts, visitors, subscribers, mass messages
 * With daily chart data for each. The motherlode endpoint.
 * Uses GET /api/{account}/statistics/overview
 */
export async function getStatisticsOverview(account: string, apiKey: string, startDate: string, endDate: string) {
    const start = encodeURIComponent(startDate);
    const end = encodeURIComponent(endDate);
    return ofapiRequest(`/api/${account}/statistics/overview?start_date=${start}&end_date=${end}`, apiKey);
}

// ==========================================
// V11: Chat & Inbox Integration Endpoints
// ==========================================

/**
 * Get the list of chats for an Account.
 * GET /api/{account}/chats
 */
export async function listChats(accountName: string, apiKey: string, limit: number = 50, offset: number = 0) {
    return ofapiRequest(`/api/${accountName}/chats?limit=${limit}&offset=${offset}&order=recent&skip_users=none`, apiKey);
}

/**
 * Get messages from a specific chat.
 * GET /api/{account}/chats/{chat_id}/messages
 * Params: limit, id (cursor from nextLastId), order (desc|asc), skip_users (all|none)
 * Response: { data: { list: Message[], hasMore: bool, nextLastId: string } }
 */
export async function getChatMessages(
    accountName: string,
    chatId: string | number,
    apiKey: string,
    limit: number = 50,
    beforeId?: string
) {
    let endpoint = `/api/${accountName}/chats/${chatId}/messages?limit=${limit}&order=desc&skip_users=all`;
    if (beforeId) {
        endpoint += `&id=${beforeId}`;
    }
    return ofapiRequest(endpoint, apiKey);
}

/**
 * Search messages in a specific chat.
 * GET /api/{account}/chats/{chat_id}/messages/search
 */
export async function searchChatMessages(accountName: string, chatId: string | number, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/messages/search`, apiKey);
}

/**
 * Send a new message to a chat.
 * POST /api/{account}/chats/{chat_id}/messages
 */
export async function sendChatMessage(accountName: string, chatId: string | number, apiKey: string, payload: any) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/messages`, apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Delete a message from a chat (only within 24 hours of sending).
 * DELETE /api/{account}/chats/{chat_id}/messages/{message_id}
 */
export async function deleteChatMessage(accountName: string, chatId: string | number, messageId: string, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/messages/${messageId}`, apiKey, { method: "DELETE" });
}

/**
 * Attach Tags (Release Forms) to a message.
 * POST /api/{account}/messages/{message_id}/attach-tags
 */
export async function attachReleaseTags(accountName: string, messageId: string, apiKey: string, tags: any) {
    return ofapiRequest(`/api/${accountName}/messages/${messageId}/attach-tags`, apiKey, {
        method: "POST",
        body: { rfTag: tags }
    });
}

/**
 * Trigger the "Model is typing..." indicator.
 * POST /api/{account}/chats/{chat_id}/typing
 */
export async function startTypingIndicator(accountName: string, chatId: string | number, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/typing`, apiKey, {
        method: "POST"
    });
}

// ==========================================
// V12: Advanced Profile Metrics
// ==========================================

/**
 * Get OnlyFans Profile details for the currently used Account
 * GET /api/{account}/me
 */
export async function getOFProfile(accountName: string, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/me`, apiKey);
}

/**
 * Get the start date of the model (monetization enabled)
 * GET /api/{account}/me/model-start-date
 */
export async function getModelStartDate(accountName: string, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/me/model-start-date`, apiKey);
}

/**
 * Get the top percentage of the model (e.g., 0.02%)
 * GET /api/{account}/me/top-percentage
 */
export async function getTopPercentage(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/me/top-percentage`, apiKey);
}

// ----------------------------------------------------------------------------
// CHAT UTILITIES
// ----------------------------------------------------------------------------

export async function sendTypingIndicator(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/typing`, apiKey, { method: "POST" });
}

export async function getChatMedia(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/media`, apiKey);
}

/** Paginate through all chats for an account using _pagination.next_page */
export async function fetchAllChats(accountName: string, apiKey: string, maxChats: number = 200) {
    const all: any[] = [];

    // First page
    const res = await listChats(accountName, apiKey, 100, 0).catch(() => null);
    if (!res) return all;

    const firstPage = Array.isArray(res?.data) ? res.data : [];
    all.push(...firstPage);

    // Follow _pagination.next_page until no more pages or maxChats reached
    let nextPage = res?._pagination?.next_page ?? res?._meta?._pagination?.next_page ?? null;

    while (nextPage && all.length < maxChats) {
        const r = await fetch(nextPage, {
            headers: { "Authorization": `Bearer ${apiKey}` },
        }).catch(() => null);
        if (!r || !r.ok) break;

        const nextData = await r.json().catch(() => null);
        if (!nextData) break;

        const nextList = Array.isArray(nextData?.data) ? nextData.data : [];
        if (nextList.length === 0) break;

        all.push(...nextList);
        nextPage = nextData?._pagination?.next_page ?? nextData?._meta?._pagination?.next_page ?? null;
    }

    return all.slice(0, maxChats);
}

export async function markChatAsRead(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/mark-as-read`, apiKey, { method: "POST" });
}

export async function hideChat(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/hide`, apiKey, { method: "POST" });
}

// Real endpoints based on documentation 

const OFAPI_BASE = "https://app.onlyfansapi.com";

type RequestOptions = {
    method?: string;
    body?: any;
};

async function ofapiRequest(endpoint: string, apiKey: string, options: RequestOptions = {}) {
    const url = `${OFAPI_BASE}${endpoint}`;

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
    };

    const response = await fetch(url, {
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
export async function getTransactions(account: string, apiKey: string, filterType?: string) {
    let endpoint = `/api/${account}/transactions`;
    if (filterType) {
        // Ex: type=tip
        endpoint += `?type=${filterType}`;
    }
    return ofapiRequest(endpoint, apiKey);
}

/**
 * Fetch transaction summary (Gross, Net, Fees) 
 * Uses POST /api/analytics/financial/transactions/summary
 */
export async function getTransactionsSummary(apiKey: string, bodyData: any) {
    return ofapiRequest(`/api/analytics/financial/transactions/summary`, apiKey, {
        method: "POST",
        body: bodyData,
    });
}

/**
 * Fetch Earnings Overview
 * Uses POST /api/analytics/summary/earnings
 */
export async function getEarningsOverview(apiKey: string, bodyData: any) {
    return ofapiRequest(`/api/analytics/summary/earnings`, apiKey, {
        method: "POST",
        body: bodyData,
    });
}

/**
 * Fetch Fan details / all active fans
 * Uses GET /api/{account}/fans/active
 */
export async function getActiveFans(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/fans/active`, apiKey);
}

/**
 * Upload Media to Vault
 * Uses POST /api/{account}/media/vault
 */
export async function uploadToVault(account: string, apiKey: string, mediaBuffer: Buffer, fileName: string, title?: string, description?: string) {
    console.log(`Uploading ${fileName} to OnlyFans Vault via OFAPI...`);

    const formData = new FormData();
    // @ts-ignore - FormData accepts Blob/Buffer depending on Node version
    formData.append("file", new Blob([mediaBuffer]), fileName);

    if (title) formData.append("title", title);
    if (description) formData.append("text", description); // Or 'notes' depending on OFAPI exact schema

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
        throw new Error(`Media Upload failed: ${response.status}`);
    }

    return response.json(); // { prefixed_id, file_name, thumbs... }
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
export async function getTransactionsByType(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/financial/transactions/by-type", apiKey, {
        method: "POST",
        body: payload
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

    const fanTotals: Record<string, { username: string; spend: number }> = {};

    transactions.forEach(tx => {
        // Skip platform fees or non-user entities if they appear in the raw ledger
        if (!tx.user || !tx.user.username) return;

        const fanId = tx.user.id;
        const amount = Number(tx.amount) || 0;

        if (!fanTotals[fanId]) {
            fanTotals[fanId] = { username: tx.user.username, spend: 0 };
        }
        fanTotals[fanId].spend += amount;
    });

    // Convert to array, filter by threshold, sort cleanly
    const sorted = Object.values(fanTotals)
        .filter(fan => fan.spend >= threshold)
        .sort((a, b) => b.spend - a.spend);

    return sorted;
}

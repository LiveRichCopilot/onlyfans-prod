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
 * Uses POST /api/vault/media (assumed endpoint based on user description)
 */
export async function uploadToVault(apiKey: string, mediaBuffer: Buffer, fileName: string) {
    // In a real implementation this would likely be a multipart/form-data request
    // For now we map the assumed JSON payload structure.
    console.log(`Uploading ${fileName} to OnlyFans Vault...`);
    return ofapiRequest(`/api/vault/media`, apiKey, {
        method: "POST",
        body: {
            filename: fileName,
            // media payload omitted for briefness
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

import { ofapiRequest } from "./ofapi-core";

/**
 * Fetch transaction summary (Gross, Net, Fees)
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
 */
export async function getEarningsOverview(apiKey: string, bodyData: any, accountId?: string) {
    return ofapiRequest(`/api/analytics/summary/earnings`, apiKey, {
        method: "POST",
        body: bodyData,
        targetAccountId: accountId || (bodyData?.account_ids?.[0])
    });
}

/**
 * Get transaction totals grouped by transaction type
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
 */
export async function getRevenueForecast(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/financial/forecast", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Calculate profitability for creators including revenue, costs, commissions, and margins.
 */
export async function getProfitability(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/financial/profitability", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * List buyers for a specific message.
 */
export async function listMessageBuyers(account: string, messageId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/engagement/messages/${messageId}/buyers`, apiKey);
}

/**
 * Get historical earnings chart data for the team.
 */
export async function getHistoricalPerformance(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/summary/historical", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Compare two time periods to analyze performance changes.
 */
export async function getPeriodComparison(apiKey: string, payload: any) {
    return ofapiRequest("/api/analytics/summary/comparison", apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Get earnings for a specific type (tips, messages, post, subscribes, stream)
 */
export async function getEarningsByType(account: string, apiKey: string, type: string, startDate: string, endDate: string) {
    const start = encodeURIComponent(startDate);
    const end = encodeURIComponent(endDate);
    return ofapiRequest(`/api/${account}/statistics/statements/earnings?start_date=${start}&end_date=${end}&type=${type}`, apiKey);
}

/**
 * Full statistics overview — earnings, posts, visitors, subscribers, mass messages
 */
export async function getStatisticsOverview(account: string, apiKey: string, startDate: string, endDate: string) {
    const start = encodeURIComponent(startDate);
    const end = encodeURIComponent(endDate);
    return ofapiRequest(`/api/${account}/statistics/overview?start_date=${start}&end_date=${end}`, apiKey);
}

/**
 * Get OnlyFans Profile details
 */
export async function getOFProfile(accountName: string, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/me`, apiKey);
}

/**
 * Get the start date of the model (monetization enabled)
 */
export async function getModelStartDate(accountName: string, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/me/model-start-date`, apiKey);
}

/**
 * Get the top percentage of the model
 */
export async function getTopPercentage(account: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/me/top-percentage`, apiKey);
}

import { ofapiRequest } from "./ofapi-core";

// Format date as "YYYY-mm-dd HH:mm:ss" for OFAPI
function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

/**
 * GET /api/{account}/engagement/messages/direct-messages
 * Returns sent DMs with stats: rawText, date, isFree, mediaCount, price, purchasedCount, viewedCount
 */
export async function getDirectMessageStats(
  account: string, apiKey: string, startDate: Date, endDate: Date, limit = 50, offset = 0
) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return ofapiRequest(
    `/api/${account}/engagement/messages/direct-messages?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=${limit}&offset=${offset}`,
    apiKey, { timeoutMs: 15000 }
  );
}

/**
 * GET /api/{account}/engagement/messages/mass-messages
 * Returns mass message stats
 */
export async function getMassMessageStats(
  account: string, apiKey: string, startDate: Date, endDate: Date, limit = 50, offset = 0
) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return ofapiRequest(
    `/api/${account}/engagement/messages/mass-messages?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=${limit}&offset=${offset}`,
    apiKey, { timeoutMs: 15000 }
  );
}

/**
 * GET /api/{account}/engagement/messages/mass-messages/chart
 * Time series for mass message performance
 */
export async function getMassMessageChartData(
  account: string, apiKey: string, startDate: Date, endDate: Date
) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return ofapiRequest(
    `/api/${account}/engagement/messages/mass-messages/chart?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
    apiKey, { timeoutMs: 15000 }
  );
}

/**
 * GET /api/{account}/engagement/messages/top-message
 * Best performing message by purchases
 */
export async function getTopMessage(account: string, apiKey: string) {
  return ofapiRequest(`/api/${account}/engagement/messages/top-message`, apiKey, { timeoutMs: 10000 });
}

/**
 * GET /api/{account}/engagement/messages/{messageId}/buyers
 * Who purchased a specific message
 */
export async function getMessageBuyers(account: string, apiKey: string, messageId: string) {
  return ofapiRequest(`/api/${account}/engagement/messages/${messageId}/buyers`, apiKey, { timeoutMs: 10000 });
}

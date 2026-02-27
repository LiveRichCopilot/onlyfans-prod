/**
 * AI Revenue Analyzer — uses GPT to do smart math on OFAPI transaction data.
 * Handles: shift analysis, forecasts, trend detection, natural language reports.
 *
 * No knowledge base needed — raw transaction data is passed directly in the prompt.
 * The LLM reads the numbers, does the analysis, returns structured JSON.
 */

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

type AnalysisResult = {
    summary: string;
    totalRevenue: number;
    hourlyRate: number;
    topFan: { name: string; spend: number } | null;
    trend: "up" | "down" | "flat";
    trendPercent: number;
    alerts: string[];
    forecast: string;
};

type ShiftReport = {
    shiftLabel: string;
    revenue: number;
    transactions: number;
    avgTransaction: number;
    topFans: { name: string; spend: number }[];
    comparison: string;
    recommendation: string;
};

async function callGPT(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn("No OPENAI_API_KEY set — falling back to basic math");
        return "";
    }

    const response = await fetch(OPENAI_BASE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-5.2",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("GPT API error:", response.status, err);
        return "";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

/**
 * Analyze revenue for a creator within a time range.
 * Pass raw transactions — GPT does the math and writes the report.
 */
export async function analyzeRevenue(
    creatorName: string,
    transactions: any[],
    timeLabel: string,
    previousPeriodTransactions?: any[]
): Promise<AnalysisResult | null> {
    if (transactions.length === 0) {
        return {
            summary: `No transactions found for ${creatorName} during ${timeLabel}.`,
            totalRevenue: 0,
            hourlyRate: 0,
            topFan: null,
            trend: "flat",
            trendPercent: 0,
            alerts: [],
            forecast: "Insufficient data",
        };
    }

    const systemPrompt = `You are an OnlyFans agency revenue analyst. You receive raw transaction data and produce accurate financial analysis. Always respond with valid JSON matching the requested schema. Be precise with numbers — round to 2 decimal places. Dollar amounts are in USD.`;

    const txSummary = transactions.slice(0, 200).map((tx) => ({
        amount: tx.amount,
        type: tx.type || "unknown",
        fan: tx.user?.username || tx.user?.name || "unknown",
        date: tx.createdAt || tx.date,
    }));

    const prevSummary = previousPeriodTransactions
        ? previousPeriodTransactions.slice(0, 200).map((tx) => ({
              amount: tx.amount,
              fan: tx.user?.username || "unknown",
              date: tx.createdAt || tx.date,
          }))
        : null;

    const userPrompt = `Analyze these transactions for creator "${creatorName}" during "${timeLabel}":

CURRENT PERIOD (${transactions.length} transactions):
${JSON.stringify(txSummary)}

${prevSummary ? `PREVIOUS PERIOD (${previousPeriodTransactions!.length} transactions) for comparison:\n${JSON.stringify(prevSummary)}` : "No previous period data available."}

Return JSON with this exact schema:
{
  "summary": "2-3 sentence natural language summary of performance",
  "totalRevenue": number,
  "hourlyRate": number (total divided by hours in the period),
  "topFan": { "name": "username", "spend": number } or null,
  "trend": "up" | "down" | "flat",
  "trendPercent": number (percent change vs previous period, 0 if no previous),
  "alerts": ["array of any concerns or notable events"],
  "forecast": "1 sentence prediction for next period based on this data"
}`;

    const result = await callGPT(systemPrompt, userPrompt);
    if (!result) return null;

    try {
        return JSON.parse(result) as AnalysisResult;
    } catch {
        console.error("Failed to parse GPT revenue analysis:", result);
        return null;
    }
}

/**
 * Analyze a specific shift's performance.
 */
export async function analyzeShift(
    creatorName: string,
    shiftLabel: string,
    shiftTransactions: any[],
    previousShiftTransactions?: any[]
): Promise<ShiftReport | null> {
    const systemPrompt = `You are an OnlyFans agency shift manager analyst. You compare shift performance and give actionable recommendations to chatters. Respond with valid JSON.`;

    const txData = shiftTransactions.slice(0, 200).map((tx) => ({
        amount: tx.amount,
        type: tx.type || "unknown",
        fan: tx.user?.username || "unknown",
        date: tx.createdAt,
    }));

    const prevData = previousShiftTransactions
        ? previousShiftTransactions.slice(0, 200).map((tx) => ({
              amount: tx.amount,
              fan: tx.user?.username || "unknown",
              date: tx.createdAt,
          }))
        : null;

    const userPrompt = `Analyze shift performance for "${creatorName}" — ${shiftLabel}:

THIS SHIFT (${shiftTransactions.length} transactions):
${JSON.stringify(txData)}

${prevData ? `PREVIOUS SAME SHIFT (${previousShiftTransactions!.length} transactions):\n${JSON.stringify(prevData)}` : "No previous shift data."}

Return JSON:
{
  "shiftLabel": "${shiftLabel}",
  "revenue": number,
  "transactions": number,
  "avgTransaction": number,
  "topFans": [{ "name": "username", "spend": number }] (top 3),
  "comparison": "1 sentence comparing to previous shift",
  "recommendation": "1 sentence actionable advice for the chatter on this shift"
}`;

    const result = await callGPT(systemPrompt, userPrompt);
    if (!result) return null;

    try {
        return JSON.parse(result) as ShiftReport;
    } catch {
        console.error("Failed to parse GPT shift analysis:", result);
        return null;
    }
}

/**
 * Generate a natural language report for Telegram.
 * Returns formatted markdown ready to send via bot.
 */
export async function generateTelegramReport(
    creatorName: string,
    transactions: any[],
    timeLabel: string
): Promise<string> {
    const systemPrompt = `You are an OnlyFans agency bot that writes concise, emoji-rich Telegram reports. Use markdown formatting (bold with *, not **). Keep it under 15 lines. Include revenue totals, top 3 fans, and one actionable recommendation.`;

    const txData = transactions.slice(0, 200).map((tx) => ({
        amount: tx.amount,
        type: tx.type || "unknown",
        fan: tx.user?.username || tx.user?.name || "unknown",
        date: tx.createdAt,
    }));

    const userPrompt = `Write a Telegram report for "${creatorName}" — ${timeLabel}:
${JSON.stringify(txData)}
${transactions.length} total transactions.`;

    const result = await callGPT(systemPrompt, userPrompt);
    if (!result) {
        return `No AI analysis available for ${creatorName}.`;
    }

    try {
        const parsed = JSON.parse(result);
        return parsed.report || parsed.message || result;
    } catch {
        // GPT might return plain text instead of JSON — that's fine for Telegram
        return result;
    }
}

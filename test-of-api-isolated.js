import fetch from 'node-fetch';

const token = "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5";
const creator_id = "513271711"; 

async function run() {
    const payload = {
        account_ids: [creator_id],
        start_date: "2026-02-19T00:00:00.000Z",
        end_date: "2026-02-28T00:00:00.000Z"
    };

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*"
    };

    try {
        console.log("Fetching /transactions/summary...");
        const res1 = await fetch("https://app.onlyfansapi.com/api/analytics/financial/transactions/summary", {
            method: "POST", headers, body: JSON.stringify(payload)
        });
        const summary = await res1.json().catch(() => ({ error: "failed to parse", status: res1.status }));

        console.log("\n--- SUMMARY ENDPOINT ---");
        console.log(JSON.stringify(summary, null, 2));

        console.log("\nFetching /summary/earnings...");
        const res2 = await fetch("https://app.onlyfansapi.com/api/analytics/summary/earnings", {
            method: "POST", headers, body: JSON.stringify(payload)
        });
        const earnings = await res2.json().catch(() => ({ error: "failed to parse", status: res2.status }));
        
        console.log("\n--- EARNINGS ENDPOINT ---");
        console.log(JSON.stringify(earnings, null, 2));

        console.log("\nFetching raw /transactions (limit=2000)...");
        const res3 = await fetch(`https://app.onlyfansapi.com/api/${creator_id}/transactions?limit=2000`, {
            method: "GET", headers
        });
        const rawTxs = await res3.json().catch(() => ({ error: "failed to parse", status: res3.status }));
        
        const list = rawTxs?.list || rawTxs?.data?.list || [];
        const recentTxs = list.filter(t => new Date(t.createdAt) >= new Date("2026-02-19T00:00:00Z"));
        let manualSum = 0;
        recentTxs.forEach(t => manualSum += parseFloat(t.amount || t.gross || t.price || "0"));

        console.log(`\n--- RAW TRANSACTIONS: ${recentTxs.length} items since Feb 19 ---`);
        console.log(`Manual Sum of those raw items: $${manualSum.toFixed(2)}`);

    } catch (e) {
        console.log("Terminal Error:", e);
    }
}
run();

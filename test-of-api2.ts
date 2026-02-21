import { PrismaClient } from '@prisma/client';
import { getTransactionsSummary, getTransactions, getTransactionsByType } from './lib/ofapi';

const prisma = new PrismaClient();

async function run() {
    const lauren = await prisma.creator.findFirst({
        where: { name: { contains: "Lauren" } }
    });
    
    if (!lauren) return console.log("No lauren found");
    
    console.log("Tokens found:", lauren.ofapiCreatorId, lauren.ofapiToken.substring(0, 5) + "...");
    
    const now = new Date();
    // Use an exact 7-day window to match her OF dashboard exactly
    const startWindow = new Date("2026-02-19T00:00:00Z"); 
    
    const payload = {
        account_ids: [lauren.ofapiCreatorId],
        start_date: startWindow.toISOString(),
        end_date: now.toISOString()
    };
    
    console.log("Sending payload:", payload);
    
    try {
        const [summary, rawLists, byType] = await Promise.all([
            getTransactionsSummary(lauren.ofapiToken, payload),
            getTransactions(lauren.ofapiCreatorId, lauren.ofapiToken, undefined, 2000),
            getTransactionsByType(lauren.ofapiToken, payload)
        ]);

        console.log("=== BY TYPE ===");
        console.log(JSON.stringify(byType, null, 2));

        console.log("\n=== SUMMARY OVERVIEW ===");
        console.log(JSON.stringify(summary, null, 2));

        const list = rawLists?.list || rawLists?.data?.list || [];
        console.log(`\n=== RAW TRANSACTIONS: ${list.length} FETCHED ===`);
        
        const recentTxs = list.filter((t:any) => new Date(t.createdAt) >= startWindow);
        let manualSum = 0;
        recentTxs.forEach((t:any) => manualSum += parseFloat(t.amount || t.gross || t.price || "0"));
        
        console.log(`Manual Sum of ${recentTxs.length} items since Feb 19: $${manualSum.toFixed(2)}`);

        if (recentTxs.length > 0) {
            console.log("\nSample Latest Tx:", JSON.stringify(recentTxs[0], null, 2));
            console.log("\nSample Oldest Tx:", JSON.stringify(recentTxs[recentTxs.length - 1], null, 2));
        }

    } catch (e) {
        console.error("Failed API Call", e);
    }
}
run();

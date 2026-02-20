require("dotenv").config();
const account = "angiyang"; // Testing with the account in your screenshot
const apiKey = process.env.OFAPI_API_KEY;

async function run() {
    try {
        const response = await fetch(`https://app.onlyfansapi.com/api/${account}/transactions`, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });
        const json = await response.json();
        
        const allTx = json.data?.list || json.list || json.transactions || [];
        console.log(`Successfully fetched ${allTx.length} recent transactions.`);
        
        if (allTx.length > 0) {
           console.log("Sample Transaction Field Keys:");
           // Print exactly what fields OnlyFans returns for a single transaction
           console.log(JSON.stringify(allTx[0], null, 2));
           
           const now = new Date();
           const start1h = new Date(now.getTime() - (1 * 60 * 60 * 1000));
           const txs1h = allTx.filter(t => new Date(t.createdAt) >= start1h);
           
           console.log(`\nFound ${txs1h.length} transactions strictly within the last 60 minutes.`);
           
           const manualGross1h = txs1h.reduce((sum, t) => {
                return sum + (parseFloat(t.amount || t.gross || t.price || "0"));
           }, 0);
           console.log(`\nAccurate 60-Minute Velocity Sum: $${manualGross1h.toFixed(2)}`);
        }
    } catch(e) {
        console.error(e.message);
    }
}
run();

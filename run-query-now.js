require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Fetching live creator...");
    const creator = await prisma.creator.findFirst({
        where: { ofapiToken: { not: "unlinked" }, active: true }
    });

    if (!creator || !creator.ofapiToken) {
        console.error("No active creator found");
        process.exit(1);
    }
    
    console.log(`Using token for creator: ${creator.name}`);

    const payload = {
        account_ids: [creator.ofapiCreatorId],
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
    };

    const res = await fetch("https://app.onlyfansapi.com/api/analytics/financial/transactions/by-type", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + creator.ofapiToken
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        console.error(`OF API HTTP Error: ${res.status}`);
        const errText = await res.text();
        console.error(errText);
        process.exit(1);
    }

    const data = await res.json();
    console.log("=== BY TYPE DATA ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("====================");
    process.exit(0);
}

run();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const creator = await prisma.creator.findFirst({
        where: { ofapiToken: "linked_via_auth_module" }
    });

    if (!creator) {
        console.log("No creator connected");
        return;
    }

    const now = new Date();
    const startWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const payload = {
        account_ids: [creator.ofapiCreatorId],
        start_date: startWindow.toISOString(),
        end_date: now.toISOString()
    };

    const token = process.env.OFAPI_API_KEY || "cb0ce7d1-e945-4235-96bd-209210e30d62"; // Fallback to your test key if env not loaded

    console.log("Fetching with token:", token);
    const res = await fetch("https://app.onlyfansapi.com/api/analytics/financial/transactions/by-type", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);

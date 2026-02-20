import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const creator = await prisma.creator.findFirst({
        where: { ofapiToken: "linked_via_auth_module" }
    });

    if (!creator) return console.log("No creator connected");

    const token = "cb0ce7d1-e945-4235-96bd-209210e30d62"; // Using testing key
    const payload = {
        account_ids: [creator.ofapiCreatorId],
        start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
    };

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

run();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    try {
        const creator = await prisma.creator.findFirst({
            where: { active: true },
            orderBy: { createdAt: 'desc' }
        });
        
        if (!creator || !creator.ofapiToken) {
           console.log("No token in DB");
           process.exit();
        }

        console.log("Token starts with:", creator.ofapiToken.substring(0, 8));

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

        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) { console.error(e); }
    process.exit();
}
run();

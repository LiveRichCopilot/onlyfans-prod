import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function run() {
    const lauren = await prisma.creator.findFirst({
        where: { name: { contains: "Lauren" } }
    });
    
    if (!lauren) return console.log("No lauren found");
    
    console.log("Tokens found:", lauren.ofapiCreatorId, lauren.ofapiToken.substring(0, 5) + "...");
    
    const now = new Date();
    const start24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const payload = {
        account_ids: [lauren.ofapiCreatorId],
        start_date: start24h.toISOString(),
        end_date: now.toISOString()
    };
    
    console.log("Sending payload:", payload);
    
    const res = await fetch(`http://localhost:3000/api/proxy?endpoint=/api/analytics/financial/transactions/summary`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lauren.ofapiToken}`
        },
        body: JSON.stringify(payload)
    });
    
    const data = await res.json().catch(e => ({ error: e.message, text: "failed to parse" }));
    console.log("Response:", data);
}
run();

import { PrismaClient } from '@prisma/client';
import { getTransactionsSummary, getTransactionsByType } from './lib/ofapi';

const prisma = new PrismaClient();

async function run() {
    const creator = await prisma.creator.findFirst({ where: { name: "angiyang" } });
    if (!creator) {
        console.log("Could not find creator angiyang in DB");
        return;
    }
    
    console.log(`Found Creator: ${creator.name} (OF_ID: ${creator.ofapiCreatorId})`);
    
    const now = new Date();
    const startWindow = new Date(now.getTime() - (1 * 60 * 60 * 1000));
    
    const payload = {
        accounts: [creator.ofapiCreatorId || creator.telegramId],
        date_range: { start: startWindow.toISOString(), end: now.toISOString() }
    };
    
    try {
        const summary = await getTransactionsSummary(creator.ofapiToken!, payload);
        const byType = await getTransactionsByType(creator.ofapiToken!, payload);
        
        console.log(`\n=== PERFORMANCE REPORT: ${creator.name} ===`);
        console.log(`Window: Last 1h`);
        console.log(`Gross Revenue: $${(summary.gross || 0).toFixed(2)}`);
        console.log(`Net Profit: $${(summary.net || 0).toFixed(2)}`);
        console.log(`Platform Fees: $${(summary.fees || 0).toFixed(2)}\n`);
        console.log(`Breakdown:`);
        console.log(`- Subscriptions: $${(byType?.subscriptions || 0).toFixed(2)}`);
        console.log(`- Tips: $${(byType?.tips || 0).toFixed(2)}`);
        console.log(`- Messages: $${(byType?.messages || 0).toFixed(2)}`);
    } catch (e) {
        console.error("API Error", e);
    }
}

run();

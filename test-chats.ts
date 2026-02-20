import "dotenv/config";
import { prisma } from "./lib/prisma";
import { listChats } from "./lib/ofapi";

async function run() {
    try {
        console.log("Fetching creators...");
        const creators = await prisma.creator.findMany();

        for (const c of creators) {
            console.log(`Creator: ${c.name} (Telegram: ${c.telegramId}, Account: ${c.ofapiCreatorId})`);
            if (c.ofapiToken && c.ofapiToken !== 'unlinked') {
                console.log(`- Token found. Attempting listChats...`);
                try {
                    const chats = await listChats(c.ofapiCreatorId || c.telegramId, c.ofapiToken);
                    console.log(`- Response keys:`, Object.keys(chats));
                    if (Array.isArray(chats)) {
                        console.log(`- Response is Array. Length: ${chats.length}`);
                        if (chats.length > 0) console.log(`- Sample chat:`, JSON.stringify(chats[0]).slice(0, 200));
                    } else if (chats.list) {
                        console.log(`- Response has 'list' property. Length: ${chats.list.length}`);
                        if (chats.list.length > 0) console.log(`- Sample chat:`, JSON.stringify(chats.list[0]).slice(0, 200));
                    } else {
                        console.log(`- Response payload:`, JSON.stringify(chats).slice(0, 500));
                    }
                } catch (e: any) {
                    console.log(`- Failed to fetch chats: ${e.message}`);
                }
            } else {
                console.log(`- No token set.`);
            }
        }
    } catch (e) {
        console.error("Diagnostic error:", e);
    }
}

run();

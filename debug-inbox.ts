import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();
const OFAPI_BASE = "https://app.onlyfansapi.com";

async function run() {
    const creator = await prisma.creator.findFirst({
        where: { ofapiToken: { not: 'unlinked' } }
    });
    if (!creator) {
        console.log("No linked creator found.");
        process.exit(0);
    }

    console.log("Using creator:", creator.ofapiCreatorId || creator.telegramId);

    const apiKey = process.env.OFAPI_API_KEY;

    // Fetch chats
    const chatsUrl = `${OFAPI_BASE}/api/${creator.ofapiCreatorId || creator.telegramId}/chats`;
    const chatsRes = await fetch(chatsUrl, { headers: { "Authorization": `Bearer ${apiKey}` } });
    const chatsData = await chatsRes.json();

    const chatsArray = chatsData.list || chatsData.data || chatsData;
    if (!chatsArray || chatsArray.length === 0) {
        console.log("No chats found.");
        process.exit(0);
    }

    const firstChat = chatsArray[0];
    const chatId = firstChat.chat_id || firstChat.withUser?.id || firstChat.id;
    console.log("First chat ID:", chatId);

    // Fetch messages
    const msgsUrl = `${OFAPI_BASE}/api/${creator.ofapiCreatorId || creator.telegramId}/chats/${chatId}/messages`;
    const msgsRes = await fetch(msgsUrl, { headers: { "Authorization": `Bearer ${apiKey}` } });
    const msgsData = await msgsRes.json();

    console.log("Raw Messages Output (first 2):");
    const msgsArray = msgsData.list || msgsData.data || msgsData;
    console.log(JSON.stringify(msgsArray.slice(0, 2), null, 2));

    process.exit(0);
}
run();

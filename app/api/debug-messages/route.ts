import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";

export async function GET(request: Request) {
    try {
        const creator = await prisma.creator.findFirst({
            where: { ofapiToken: { not: 'unlinked' } }
        });
        if (!creator) return NextResponse.json({ error: "No creator" });

        const apiKey = process.env.OFAPI_API_KEY;
        const chatsUrl = `${OFAPI_BASE}/api/${creator.ofapiCreatorId || creator.telegramId}/chats?limit=5`;
        const chatsRes = await fetch(chatsUrl, { headers: { "Authorization": `Bearer ${apiKey}` } });
        const chatsData = await chatsRes.json();

        const chatsArray = chatsData.list || chatsData.data || chatsData;
        if (!chatsArray || chatsArray.length === 0) return NextResponse.json({ error: "No chats" });

        const firstChat = chatsArray[0];
        const chatId = firstChat.withUser?.id || firstChat.fan?.id || firstChat.chat_id || firstChat.id;

        const msgsUrl = `${OFAPI_BASE}/api/${creator.ofapiCreatorId || creator.telegramId}/chats/${chatId}/messages?limit=3`;
        const msgsRes = await fetch(msgsUrl, { headers: { "Authorization": `Bearer ${apiKey}` } });
        const msgsData = await msgsRes.json();

        return NextResponse.json({ chat: firstChat, messages: msgsData.list || msgsData.data || msgsData });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

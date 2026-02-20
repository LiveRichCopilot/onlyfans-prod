"use server";

import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/ofapi";

export async function dumpKeys() {
    try {
        const creator = await prisma.creator.findFirst({
            where: { ofapiToken: { not: null } }
        });

        if (!creator || !creator.ofapiToken) {
            return { error: "No active creator" };
        }

        const data = await getTransactions(creator.ofapiCreatorId || creator.telegramId, creator.ofapiToken);

        const list = data.data?.list || data.list || data.transactions || [];
        if (list.length > 0) {
            return { success: true, keys: Object.keys(list[0]), sample: list[0] };
        }
        return { success: true, count: 0 };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

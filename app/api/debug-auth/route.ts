import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const accounts = await prisma.account.findMany({
            where: { provider: "onlyfans" }
        });

        // Mask the tokens for safety before sending to client
        const safeAccounts = accounts.map(acc => ({
            id: acc.id,
            userId: acc.userId,
            providerAccountId: acc.providerAccountId,
            access_token_prefix: acc.access_token ? acc.access_token.substring(0, 10) + '...' : null
        }));

        const creators = await prisma.creator.findMany();

        return NextResponse.json({ accounts: safeAccounts, creators });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

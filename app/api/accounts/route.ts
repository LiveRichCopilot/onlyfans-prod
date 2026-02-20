import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const { accountId, username, displayName, name, avatar } = await request.json();

        if (!accountId || !username) {
            return NextResponse.json(
                { error: "accountId and username are required" },
                { status: 400 }
            );
        }

        // In a production app, we would bind the OF API token specifically to this creator
        const account = await prisma.creator.create({
            data: {
                ofapiCreatorId: username,
                telegramId: accountId, // fallback for now to ensure uniqueness
                ofapiToken: "linked_via_auth_module"
            },
        });

        return NextResponse.json(account, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

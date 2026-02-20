import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const { accountId, username, telegramGroupId } = await request.json();

        if (!accountId || !username) {
            return NextResponse.json(
                { error: "accountId and username are required" },
                { status: 400 }
            );
        }

        // Initialize the account in an unlinked state
        const account = await prisma.creator.create({
            data: {
                ofapiCreatorId: username,
                telegramId: accountId, // fallback for now to ensure uniqueness
                telegramGroupId: telegramGroupId || null,
                ofapiToken: "unlinked"
            },
        });

        return NextResponse.json(account, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { id, ofapiToken, ofapiCreatorId, name } = await request.json();

        if (!id || !ofapiToken) {
            return NextResponse.json(
                { error: "id and ofapiToken are required" },
                { status: 400 }
            );
        }

        const dataToUpdate: any = { ofapiToken };
        if (ofapiCreatorId) dataToUpdate.ofapiCreatorId = ofapiCreatorId;
        if (name) dataToUpdate.name = name;

        const account = await prisma.creator.update({
            where: { id },
            data: dataToUpdate
        });

        return NextResponse.json(account, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

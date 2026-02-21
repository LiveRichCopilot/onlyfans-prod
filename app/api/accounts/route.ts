import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/ofapi";

export async function POST(request: NextRequest) {
    try {
        const { accountId, username, telegramGroupId, name, avatar } = await request.json();

        if (!accountId || !username) {
            return NextResponse.json(
                { error: "accountId and username are required" },
                { status: 400 }
            );
        }

        const account = await prisma.creator.create({
            data: {
                ofapiCreatorId: username,
                telegramId: accountId,
                telegramGroupId: telegramGroupId || null,
                ofapiToken: "unlinked",
                name: name || null,
                avatarUrl: avatar || null
            },
        });

        return NextResponse.json(account, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        let { id, ofapiToken, ofapiCreatorId, name } = await request.json();

        if (!id || !ofapiToken) {
            return NextResponse.json(
                { error: "id and ofapiToken are required" },
                { status: 400 }
            );
        }

        const dataToUpdate: any = { ofapiToken };
        if (ofapiCreatorId) dataToUpdate.ofapiCreatorId = ofapiCreatorId;
        if (name) dataToUpdate.name = name;

        // Fetch authentic profile metadata directly from OnlyFans
        try {
            const me = await getMe(ofapiCreatorId, ofapiToken);
            if (me && me.name) {
                dataToUpdate.name = me.name;
            }
            if (me && me.avatar) {
                dataToUpdate.avatarUrl = me.avatar;
            }
        } catch (e) {
            console.log("Could not fetch authentic profile metadata:", e);
        }

        const account = await prisma.creator.update({
            where: { id },
            data: dataToUpdate
        });

        return NextResponse.json(account, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

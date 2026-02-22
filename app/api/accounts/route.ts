import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/ofapi";

const OFAPI_BASE = "https://app.onlyfansapi.com";

/**
 * Fetch full profile from OFAPI for a newly added creator.
 * Uses the master API key to pull name, avatar, header, username.
 */
async function fetchAndSyncProfile(creatorId: string, ofapiCreatorId: string) {
    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) return;

    try {
        // Fetch all accounts from OFAPI
        const accountsRes = await fetch(`${OFAPI_BASE}/api/accounts`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!accountsRes.ok) return;

        const accounts = await accountsRes.json();
        const accountList = Array.isArray(accounts) ? accounts : accounts?.data || [];

        // Match by account ID or username
        const match = accountList.find((a: any) =>
            a.id === ofapiCreatorId ||
            a.onlyfans_username === ofapiCreatorId ||
            a.display_name === ofapiCreatorId
        );

        if (!match) return;

        const userData = match.onlyfans_user_data || {};
        const updateData: any = {
            ofapiToken: apiKey, // Mark as linked via master key
            ofapiCreatorId: match.id, // Ensure we store the actual account ID
        };

        const displayName = userData.name || match.display_name;
        if (displayName) updateData.name = displayName;

        const username = match.onlyfans_username || userData.username;
        if (username) updateData.ofUsername = username;

        const avatar = userData.avatar || userData.avatarUrl;
        if (avatar) updateData.avatarUrl = avatar;

        const header = userData.header || userData.headerUrl || userData.header_image;
        if (header) updateData.headerUrl = header;

        await prisma.creator.update({
            where: { id: creatorId },
            data: updateData,
        });
    } catch (e: any) {
        console.error("Auto-sync profile failed:", e.message);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { accountId, username, telegramGroupId, name, avatar } = await request.json();

        if (!username) {
            return NextResponse.json({ error: "username is required" }, { status: 400 });
        }

        // Use agency owner's telegram ID if not provided
        const telegramId = accountId || (await prisma.creator.findFirst({ select: { telegramId: true } }))?.telegramId || "agency";

        // Find existing creator
        let account = await prisma.creator.findFirst({
            where: { ofapiCreatorId: username },
        });

        if (account) {
            account = await prisma.creator.update({
                where: { id: account.id },
                data: {
                    telegramId,
                    telegramGroupId: telegramGroupId || null,
                    name: name || account.name,
                    avatarUrl: avatar || account.avatarUrl,
                },
            });
        } else {
            account = await prisma.creator.create({
                data: {
                    ofapiCreatorId: username,
                    telegramId,
                    telegramGroupId: telegramGroupId || null,
                    ofapiToken: "unlinked",
                    name: name || null,
                    avatarUrl: avatar || null,
                },
            });
        }

        // Immediately fetch and sync profile from OFAPI — no fire-and-forget
        await fetchAndSyncProfile(account.id, username);

        // Re-fetch the updated account to return fresh data
        const updated = await prisma.creator.findUnique({ where: { id: account.id } });

        return NextResponse.json(updated || account, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        let { id, ofapiToken, ofapiCreatorId, name } = await request.json();

        if (!id || !ofapiToken) {
            return NextResponse.json({ error: "id and ofapiToken are required" }, { status: 400 });
        }

        const dataToUpdate: any = { ofapiToken };
        if (ofapiCreatorId) dataToUpdate.ofapiCreatorId = ofapiCreatorId;
        if (name) dataToUpdate.name = name;

        // Fetch authentic profile metadata directly from OnlyFans
        try {
            const me = await getMe(ofapiCreatorId, ofapiToken);
            if (me && me.name) dataToUpdate.name = me.name;
            if (me && me.avatar) dataToUpdate.avatarUrl = me.avatar;
        } catch (e) {
            console.log("Could not fetch authentic profile metadata:", e);
        }

        const account = await prisma.creator.update({
            where: { id },
            data: dataToUpdate,
        });

        return NextResponse.json(account, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

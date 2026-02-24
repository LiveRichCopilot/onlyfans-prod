import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";

export async function GET() {
    try {
        const apiKey = process.env.OFAPI_API_KEY || "";
        if (!apiKey) {
            return NextResponse.json({ error: "No OFAPI_API_KEY configured" }, { status: 500 });
        }

        // Fetch all accounts from OFAPI — this has the full profile data
        const accountsRes = await fetch(`${OFAPI_BASE}/api/accounts`, {
            headers: { "Authorization": `Bearer ${apiKey}` },
        });

        if (!accountsRes.ok) {
            return NextResponse.json({ error: `OFAPI error: ${accountsRes.status}` }, { status: 500 });
        }

        const accounts = await accountsRes.json();
        const updated: any[] = [];

        // Get all creators from our DB
        // Sync ALL creators, including unlinked ones (they still need profile data)
        const creators = await prisma.creator.findMany();

        for (const creator of creators) {
            // Match by ofapiCreatorId (the acct_xxx ID)
            // Match by account ID or OF username
            const accountList = Array.isArray(accounts) ? accounts : accounts?.data || [];
            const ofAccount = accountList.find((a: any) =>
                a.id === creator.ofapiCreatorId ||
                a.onlyfans_username === creator.ofapiCreatorId ||
                a.onlyfans_username === creator.ofUsername
            );

            if (!ofAccount) continue;

            const userData = ofAccount.onlyfans_user_data || {};
            const updateData: any = {};

            // Name — use the OF display name
            const displayName = userData.name || ofAccount.display_name;
            if (displayName && displayName !== creator.name) {
                updateData.name = displayName;
            }

            // Username — the actual @handle
            const username = ofAccount.onlyfans_username || userData.username;
            if (username) {
                updateData.ofUsername = username;
            }

            // Avatar
            const avatar = userData.avatar || userData.avatarUrl;
            if (avatar) {
                updateData.avatarUrl = avatar;
            }

            // Header/Banner
            const header = userData.header || userData.headerUrl || userData.header_image;
            if (header) {
                updateData.headerUrl = header;
            }

            // If unlinked but we found a match, mark as linked (env var resolved at runtime)
            if (creator.ofapiToken === "unlinked" && ofAccount) {
                updateData.ofapiToken = "linked_via_auth_module";
                updateData.ofapiCreatorId = ofAccount.id;
            }

            if (Object.keys(updateData).length > 0) {
                await prisma.creator.update({
                    where: { id: creator.id },
                    data: updateData,
                });
                updated.push({
                    id: creator.id,
                    name: updateData.name || creator.name,
                    username: updateData.ofUsername,
                    hasAvatar: !!updateData.avatarUrl,
                    hasHeader: !!updateData.headerUrl,
                    avatarUrl: updateData.avatarUrl || null,
                    headerUrl: updateData.headerUrl || null,
                });
            }
        }

        return NextResponse.json({ success: true, updated_profiles: updated });
    } catch (e: any) {
        console.error("Sync profiles error:", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

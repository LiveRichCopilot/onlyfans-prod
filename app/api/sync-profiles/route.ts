import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const creators = await prisma.creator.findMany({
            where: { ofapiToken: { not: "unlinked" } }
        });

        const updated = [];

        for (const c of creators) {
            // Always re-sync if missing avatar, username, or header
            if (!c.avatarUrl || !c.ofUsername || !c.headerUrl || c.name === c.ofapiCreatorId) {
                try {
                    const me = await getMe(c.ofapiCreatorId || c.telegramId, c.ofapiToken as string);

                    if (me) {
                        // OFAPI /me response can have various field names — handle all possibilities
                        const profileName = me.name || me.display_name || me.displayName || c.name;
                        const username = me.username || me.onlyfans_username || me.of_username || null;
                        const avatar = me.avatar || me.avatarUrl || me.avatar_url || me.profilePicUrl || null;
                        const header = me.header || me.headerUrl || me.header_url || me.headerImage || me.banner || null;

                        const updateData: any = {};
                        if (profileName && profileName !== c.name) updateData.name = profileName;
                        if (username) updateData.ofUsername = username;
                        if (avatar) updateData.avatarUrl = avatar;
                        if (header) updateData.headerUrl = header;

                        if (Object.keys(updateData).length > 0) {
                            await prisma.creator.update({
                                where: { id: c.id },
                                data: updateData
                            });
                            updated.push({ id: c.id, name: profileName, username, hasAvatar: !!avatar, hasHeader: !!header });
                        }
                    }
                } catch (e: any) {
                    console.error(`Failed to sync ${c.ofapiCreatorId}: ${e.message}`);
                }
            }
        }

        return NextResponse.json({ success: true, updated_profiles: updated });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}

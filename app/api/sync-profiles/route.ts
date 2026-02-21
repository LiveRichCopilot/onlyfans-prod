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
            if (!c.name || !c.avatarUrl || c.name === c.ofapiCreatorId) {
                try {
                    const me = await getMe(c.ofapiCreatorId || c.telegramId, c.ofapiToken as string);
                    if (me && me.name) {
                        await prisma.creator.update({
                            where: { id: c.id },
                            data: {
                                name: me.name,
                                avatarUrl: me.avatar
                            }
                        });
                        updated.push(me.name);
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

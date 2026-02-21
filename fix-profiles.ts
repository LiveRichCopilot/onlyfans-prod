import { prisma } from "./lib/prisma";
import { getMe } from "./lib/ofapi";

async function run() {
    console.log("Starting DB retrospective profile sync...");
    const creators = await prisma.creator.findMany({
        where: { ofapiToken: { not: null, not: "unlinked" } }
    });

    for (const c of creators) {
        if (!c.name || !c.avatarUrl) {
            console.log(`Creator ${c.ofapiCreatorId || c.telegramId} is missing name/avatar. Fetching...`);
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
                    console.log(`Successfully synced ${me.name}!`);
                }
            } catch (e: any) {
                console.error(`Failed to sync ${c.ofapiCreatorId}: ${e.message}`);
            }
        } else {
            console.log(`Creator ${c.name} already has a profile.`);
        }
    }
    console.log("Done.");
}
run();

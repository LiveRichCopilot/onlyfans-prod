import { getTransactionsByType } from "./lib/ofapi";
import { prisma } from "./lib/prisma";

async function run() {
    const creator = await prisma.creator.findFirst({
        where: { ofapiToken: "linked_via_auth_module" }
    });

    if (!creator) {
        console.log("No creator connected");
        return;
    }

    const now = new Date();
    const startWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const payload = {
        account_ids: [creator.ofapiCreatorId],
        start_date: startWindow.toISOString(),
        end_date: now.toISOString()
    };

    try {
        const byType = await getTransactionsByType(creator.ofapiToken, payload);
        console.log("Raw byType response:", JSON.stringify(byType, null, 2));
    } catch (e) {
        console.error("Error fetching byType", e);
    }
}

run().catch(console.error);

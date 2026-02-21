const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const creators = await prisma.creator.findMany();
    console.log(JSON.stringify(creators.map(c => ({
        id: c.id,
        name: c.name,
        ofapiCreatorId: c.ofapiCreatorId,
        telegramId: c.telegramId,
        telegramGroupId: c.telegramGroupId,
        hasToken: !!c.ofapiToken && c.ofapiToken !== "unlinked"
    })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

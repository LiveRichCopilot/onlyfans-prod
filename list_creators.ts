import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const creators = await prisma.creator.findMany();
    console.log(JSON.stringify(creators, null, 2));
}
main().finally(() => prisma.$disconnect());

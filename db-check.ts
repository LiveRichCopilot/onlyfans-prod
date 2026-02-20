import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const creator = await prisma.creator.findFirst({ where: { name: "angiyang" } });
    console.log(creator);
}
run();

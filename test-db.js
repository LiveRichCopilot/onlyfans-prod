const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const creators = await prisma.creator.findMany();
  console.log("Creators in DB:");
  creators.forEach(c => console.log(`- ${c.name} | telegramId: ${c.telegramId} | groupId: ${c.telegramGroupId} | token: ${c.ofapiToken ? 'yes' : 'no'}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());

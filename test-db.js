const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.creator.findFirst();
  console.log(c);
}
main();

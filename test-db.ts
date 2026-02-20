import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const allCreators = await prisma.creator.findMany()
  console.log("ALL CREATORS IN POSTGRES:", JSON.stringify(allCreators, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

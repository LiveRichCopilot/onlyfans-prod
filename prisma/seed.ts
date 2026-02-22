import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Seeding initial agency creators...")

    await prisma.creator.upsert({
        where: { ofapiCreatorId: 'madison420ivy' },
        update: {},
        create: {
            telegramId: 'agency_bot_test_1',
            ofapiToken: process.env.TEST_OFAPI_KEY || 'mock_token',
            ofapiCreatorId: 'madison420ivy',
            hourlyTarget: 100.0,
            active: true,
        },
    })

    await prisma.creator.upsert({
        where: { ofapiCreatorId: 'lexibelle' },
        update: {},
        create: {
            telegramId: 'agency_bot_test_2',
            ofapiToken: 'mock_token_lexi',
            ofapiCreatorId: 'lexibelle',
            hourlyTarget: 100.0,
            active: true,
        },
    })

    await prisma.creator.upsert({
        where: { ofapiCreatorId: 'rileyreid' },
        update: {},
        create: {
            telegramId: 'agency_bot_test_3',
            ofapiToken: 'mock_token_riley',
            ofapiCreatorId: 'rileyreid',
            hourlyTarget: 100.0,
            active: false,
        },
    })

    console.log("Database seeded successfully.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

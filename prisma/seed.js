const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding initial agency creators...");

    // Add Test Creator 1 (Madison Ivy setup)
    await prisma.creator.upsert({
        where: { telegramId: 'agency_bot_test_1' },
        update: {},
        create: {
            telegramId: 'agency_bot_test_1',
            ofapiToken: process.env.TEST_OFAPI_KEY || 'mock_token',
            ofapiCreatorId: 'madison420ivy',
            hourlyTarget: 100.0,
            active: true,
        },
    });

    // Add Test Creator 2
    await prisma.creator.upsert({
        where: { telegramId: 'agency_bot_test_2' },
        update: {},
        create: {
            telegramId: 'agency_bot_test_2',
            ofapiToken: 'mock_token_lexi',
            ofapiCreatorId: 'lexibelle',
            hourlyTarget: 100.0,
            active: true,
        },
    });

    // Add Test Creator 3 (Offline/Inactive)
    await prisma.creator.upsert({
        where: { telegramId: 'agency_bot_test_3' },
        update: {},
        create: {
            telegramId: 'agency_bot_test_3',
            ofapiToken: 'mock_token_riley',
            ofapiCreatorId: 'rileyreid',
            hourlyTarget: 100.0,
            active: false,
        },
    });

    console.log("Database seeded successfully.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

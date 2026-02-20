const fs = require('fs');
const file = './lib/telegram.ts';
let code = fs.readFileSync(file, 'utf8');

const helperCode = `
async function getOrBindCreator(ctx: any) {
    const telegramId = String(ctx.from?.id);
    const telegramGroupId = String(ctx.chat?.id);
    
    let creator = await prisma.creator.findFirst({
        where: {
            OR: [
                { telegramId },
                { telegramGroupId }
            ]
        }
    });

    if (creator && creator.ofapiToken === (process.env.TEST_OFAPI_KEY || "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5")) {
        await prisma.creator.delete({ where: { id: creator.id } });
        creator = null;
    }

    if (!creator && telegramId && telegramId !== "undefined") {
        let realCreator = await prisma.creator.findFirst({
            where: { ofapiToken: "linked_via_auth_module" }
        });

        if (!realCreator) {
            realCreator = await prisma.creator.findFirst({
                where: { ofapiToken: "unlinked" }
            });
        }

        if (realCreator) {
            creator = await prisma.creator.update({
                where: { id: realCreator.id },
                data: {
                    telegramId,
                    telegramGroupId: (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') ? telegramGroupId : realCreator.telegramGroupId
                }
            });
        }
    }

    if (creator && (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') && creator.telegramGroupId !== telegramGroupId) {
        creator = await prisma.creator.update({
            where: { id: creator.id },
            data: { telegramGroupId }
        });
    }

    return creator;
}
`;

if (!code.includes('async function getOrBindCreator')) {
    code = code.replace('bot.catch((err) => {', helperCode + '\nbot.catch((err) => {');
}

// 1. Replace ping
const pingBlock = `        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        const creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });`;
code = code.replace(pingBlock, `        const telegramGroupId = String(ctx.chat?.id);
        const telegramId = String(ctx.from?.id);
        const creator = await getOrBindCreator(ctx);`);

// 2. Replace stats
code = code.replace(pingBlock, `        const creator = await getOrBindCreator(ctx);`);

// 3. Replace forecast
code = code.replace(pingBlock, `        const creator = await getOrBindCreator(ctx);`);

// 4. Replace notifications
code = code.replace(pingBlock, `        const creator = await getOrBindCreator(ctx);`);

// 5. Replace topfans
code = code.replace(pingBlock, `        const creator = await getOrBindCreator(ctx);`);

// 6. Replace report
const reportBlock = `        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);
        let creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        // SCRIPT: SMART BINDING to heal Dashboard <-> Telegram Desync
        if (creator && creator.ofapiToken === (process.env.TEST_OFAPI_KEY || "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5")) {
            await prisma.creator.delete({ where: { id: creator.id } });
            creator = null;
        }

        if (!creator && telegramId && telegramId !== "undefined") {
            let realCreator = await prisma.creator.findFirst({
                where: { ofapiToken: "linked_via_auth_module" }
            });

            if (!realCreator) {
                realCreator = await prisma.creator.findFirst({
                    where: { ofapiToken: "unlinked" }
                });
            }

            if (realCreator) {
                creator = await prisma.creator.update({
                    where: { id: realCreator.id },
                    data: {
                        telegramId,
                        telegramGroupId: (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') ? telegramGroupId : realCreator.telegramGroupId
                    }
                });
            }
        }

        // Dynamically update the group ID link if they trigger report from an unknown group
        if (creator && (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') && creator.telegramGroupId !== telegramGroupId) {
            creator = await prisma.creator.update({
                where: { id: creator.id },
                data: { telegramGroupId }
            });
        }`;
code = code.replace(reportBlock, `        const creator = await getOrBindCreator(ctx);`);

// 7. Replace start
const startBlock = `        const telegramId = String(ctx.from?.id);
        const telegramGroupId = String(ctx.chat?.id);

        // Find if this user already exists
        let creator = await prisma.creator.findFirst({
            where: { telegramId }
        });

        // SCRIPT: SMART BINDING to heal Dashboard <-> Telegram Desync
        if (creator && creator.ofapiToken === (process.env.TEST_OFAPI_KEY || "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5")) {
            await prisma.creator.delete({ where: { id: creator.id } });
            creator = null;
        }

        if (!creator && telegramId && telegramId !== "undefined") {
            let realCreator = await prisma.creator.findFirst({
                where: { ofapiToken: "linked_via_auth_module" }
            });

            if (!realCreator) {
                realCreator = await prisma.creator.findFirst({
                    where: { ofapiToken: "unlinked" }
                });
            }

            if (realCreator) {
                creator = await prisma.creator.update({
                    where: { id: realCreator.id },
                    data: {
                        telegramId,
                        telegramGroupId: (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') ? telegramGroupId : realCreator.telegramGroupId
                    }
                });
            }
        }

        if (creator) {
            // If they are starting the bot in a group chat, save the group ID
            if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
                creator = await prisma.creator.update({
                    where: { id: creator.id },
                    data: { telegramGroupId }
                });
            }`;

code = code.replace(startBlock, `        let creator = await getOrBindCreator(ctx);
        if (creator) {`);

fs.writeFileSync(file, code);

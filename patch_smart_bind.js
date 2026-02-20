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
    code = code.replace(/bot\.catch/g, helperCode + '\nbot.catch');
}

// Stats regex
const statsRegex = /const telegramId = String\(ctx\.from\?\.id\);\s*const telegramGroupId = String\(ctx\.chat\?\.id\);\s*const creator = await prisma\.creator\.findFirst\(\{[\s\S]*?\}\);/g;
code = code.replace(statsRegex, "const creator = await getOrBindCreator(ctx);");

// Report regex
const reportRegex = /const telegramId = String\(ctx\.from\?\.id\);\s*const telegramGroupId = String\(ctx\.chat\?\.id\);\s*let creator = await prisma\.creator\.findFirst\(\{[\s\S]*?\}\);\s*\/\/ SCRIPT: SMART BINDING[\s\S]*?data: \{ telegramGroupId \}\s*\}\);\s*\}/;
code = code.replace(reportRegex, "const creator = await getOrBindCreator(ctx);");

// Start regex
const startRegex = /const telegramId = String\(ctx\.from\?\.id\);\s*const telegramGroupId = String\(ctx\.chat\?\.id\);\s*\/\/ Find if this user already exists\s*let creator = await prisma\.creator\.findFirst\(\{[\s\S]*?\}\);\s*\/\/ SCRIPT: SMART BINDING[\s\S]*?telegramGroupId : realCreator.telegramGroupId\s*\}\s*\}\);\s*\}\s*\}/;
code = code.replace(startRegex, "let creator = await getOrBindCreator(ctx);");

fs.writeFileSync(file, code);

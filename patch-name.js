const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    await p.creator.update({
        where: { id: 'cmlvbmul0000011x2s610b262' },
        data: { name: 'angiyang' },
    });
    console.log('Fixed DB directly!');
}
main().catch(console.error);

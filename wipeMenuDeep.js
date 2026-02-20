const https = require('https');

const BOT_TOKEN = "8554732867:AAFIAmEyZy8ffQwRx7yTLxrH3pav0zbZKjI";

const scopes = [
    { type: "default" },
    { type: "all_private_chats" },
    { type: "all_group_chats" },
    { type: "all_chat_administrators" }
];

const langs = ['', 'en'];

async function deleteCommands() {
    for (const scope of scopes) {
        for (const lang of langs) {
            const payload = JSON.stringify({ scope, language_code: lang });
            
            await new Promise((resolve) => {
                const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMyCommands`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', c => data+=c);
                    res.on('end', () => resolve(console.log(`Deleted scope ${scope.type} lang '${lang}':`, data)));
                });
                req.write(payload);
                req.end();
            });
        }
    }
}

async function setCommands() {
    const commands = [
        { command: "start", description: "Initialize Bot" },
        { command: "report", description: "Get the live 1H/24H Revenue Brief & Top Spenders" },
        { command: "stats", description: "Get comprehensive performance report (e.g. /stats 24h)" },
        { command: "topfans", description: "Find highest spenders (e.g. /topfans 1d)" },
        { command: "forecast", description: "Generate AI revenue projection" },
        { command: "notifications", description: "Check unread priority alerts" },
        { command: "list", description: "List connected accounts" },
        { command: "ping", description: "Check system latency and group ID" }
    ];
    
    // Set for all private chats so it forces UI update in DM
    const payload = JSON.stringify({ commands, scope: { type: "all_private_chats" } });
    await new Promise((resolve) => {
        const req = https.request(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data+=c);
            res.on('end', () => resolve(console.log(`Set new private commands:`, data)));
        });
        req.write(payload);
        req.end();
    });
}

async function run() {
    await deleteCommands();
    await setCommands();
}
run();

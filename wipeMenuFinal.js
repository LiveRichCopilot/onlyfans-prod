const https = require('https');

const BOT_TOKEN = "8554732867:AAFIAmEyZy8ffQwRx7yTLxrH3pav0zbZKjI";

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

async function setCommands(scopeType) {
    const payload = JSON.stringify({ commands, scope: { type: scopeType } });
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
            res.on('end', () => resolve(console.log(`Set commands for ${scopeType}:`, data)));
        });
        req.write(payload);
        req.end();
    });
}

async function run() {
    await setCommands("default");
    await setCommands("all_private_chats");
    await setCommands("all_group_chats");
    await setCommands("all_chat_administrators");
}
run();

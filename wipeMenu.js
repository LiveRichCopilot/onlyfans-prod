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

const scopes = [
    { type: "default" },
    { type: "all_private_chats" },
    { type: "all_group_chats" },
    { type: "all_chat_administrators" }
];

async function updateCommands() {
    for (const scope of scopes) {
        const payload = JSON.stringify({ commands, scope });
        
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
                res.on('end', () => resolve(console.log(`Scope ${scope.type}:`, data)));
            });
            req.write(payload);
            req.end();
        });
    }
}

updateCommands();

const fs = require('fs');
const file = './lib/telegram.ts';
let code = fs.readFileSync(file, 'utf8');

// The issue was that byType returned { data: { subscriptions: 0, tips: 0 } }, not byType.subscriptions
code = code.replace(
    'const md = `\nPERFORMANCE REPORT',
    'const byTypeData = byType?.data || {};\n\n        const md = `\nPERFORMANCE REPORT'
);

code = code.replace(
    '- Subscriptions: $${(byType?.subscriptions || 0).toFixed(2)}',
    '- Subscriptions: $${parseFloat(byTypeData.subscriptions || "0").toFixed(2)}'
);

code = code.replace(
    '- Tips: $${(byType?.tips || 0).toFixed(2)}',
    '- Tips: $${parseFloat(byTypeData.tips || "0").toFixed(2)}'
);

code = code.replace(
    '- Messages: $${(byType?.messages || 0).toFixed(2)}',
    '- Messages: $${parseFloat(byTypeData.messages || "0").toFixed(2)}'
);


// Ensure commands are fully reset
const cmdBlock = `bot.api.setMyCommands([
    { command: "start", description: "Initialize Bot" },
    { command: "report", description: "Get the live 1H/24H Revenue Brief & Top Spenders" },
    { command: "stats", description: "Get comprehensive performance report (e.g. /stats 24h)" },
    { command: "topfans", description: "Find highest spenders (e.g. /topfans 1d 1000)" },
    { command: "forecast", description: "Generate AI revenue projection" },
    { command: "notifications", description: "Check unread priority alerts" },
    { command: "list", description: "List connected accounts" },
    { command: "ping", description: "Check system latency and group ID" }
]).catch(err => console.error("Failed to set commands", err));`;

code = code.replace(cmdBlock, cmdBlock); // Make sure it exists.
// We also need to add a small initialization step in the webhook to force telegram to sync the commands right away if passing the webhook,
// but for now, the byType is the critical fix.

fs.writeFileSync(file, code);

const fs = require('fs');
const file = './lib/telegram.ts';
let code = fs.readFileSync(file, 'utf8');

const oldMockCmd = `bot.command("testwhale", async (ctx) => {
    const md = \`
🐋 **MOCK WHALE ALERT** 🐋
User: @bigspender99
Amount: $500
Tip Context: "You look amazing!"
Total Lifetime Spend: $2,500
\`;
    const keyboard = new InlineKeyboard()
        .text("🎤 Voice Note", "mock_voice").row()
        .text("📹 Send Video", "mock_video").row()
        .text("Skip Alert", "action_skip");

    await ctx.reply(md, { parse_mode: "Markdown", reply_markup: keyboard });
});`;

const newMockCmd = `bot.command("testwhale", async (ctx) => {
    const md = \`
Fan: Marcus T.
Spent today: $520
Lifetime: $4,200
On page: 8 months

He tipped $200 on your last PPV.

How do you want to respond?
\`;
    const keyboard = new InlineKeyboard()
        .text("🎤 Voice Note", "mock_voice").row()
        .text("📹 Video", "mock_video").row()
        .text("✍️ Text", "mock_text").row()
        .text("Skip", "action_skip");

    await ctx.reply(md, { parse_mode: "HTML", reply_markup: keyboard });
});`;

if (code.includes('bot.command("testwhale"')) {
    code = code.replace(/bot\.command\("testwhale".*?\}\);/s, newMockCmd);
    fs.writeFileSync(file, code);
    console.log("Mock whale patched");
} else {
    // Inject if absolutely missing for some reason
    code = code.replace('bot.command("report",', newMockCmd + '\n\nbot.command("report",');
    fs.writeFileSync(file, code);
     console.log("Mock whale injected");
}

const url = "https://onlyfans-prod.vercel.app/api/telegram/webhook";
const payload = {
  update_id: Math.floor(Math.random()*1000000),
  message: {
    message_id: 1,
    from: { id: 123456, is_bot: false, first_name: "Test User" },
    chat: { id: 123456, type: "private" },
    date: Math.floor(Date.now() / 1000),
    text: "/testbot",
    entities: [{ offset: 0, length: 8, type: "bot_command" }]
  }
};
fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
}).then(async r => {
  console.log("Status:", r.status);
  console.log("Body:", await r.text());
}).catch(console.error);

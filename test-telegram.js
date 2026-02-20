require('dotenv').config({ path: '.env' });
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log("NO TOKEN IN .env");
} else {
  fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    .then(r => r.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(console.error);
}

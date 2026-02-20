const { Bot, webhookCallback } = require("grammy");
const bot = new Bot("dummy");
const cb = webhookCallback(bot, "std/http");
console.log(cb.toString());

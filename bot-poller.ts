import "dotenv/config";
import { bot } from "./lib/telegram";

console.log("Starting Telegram Bot in long-polling mode for testing...");
bot.start();

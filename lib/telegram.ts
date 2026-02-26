// Barrel file — re-exports bot and triggers command registration via side-effect imports
export { bot } from "./telegram-bot";

// Import all command modules so they register on the bot instance
import "./telegram-core-commands";
import "./telegram-reports";
import "./telegram-fans";
import "./telegram-analytics";
import "./telegram-media";

// We don't start polling because we will use Next.js API Webhook for serverless execution

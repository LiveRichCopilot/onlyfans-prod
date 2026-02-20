import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram";

export const POST = webhookCallback(bot, "std/http");

// @ts-nocheck — PENDING MIGRATION: Fan.followUpType, Fan.followUpMessage
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/follow-ups
 * Runs every 6 hours via Vercel cron.
 *
 * Queries fans where followUpDueAt <= now,
 * generates follow-up messages via GPT-4o-mini,
 * stores in Fan.followUpMessage, logs lifecycle event,
 * sends Telegram pings to chatters.
 */
export async function GET(request: Request) {
    if (CRON_SECRET) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        // Find fans with overdue follow-ups
        const dueFans = await prisma.fan.findMany({
            where: {
                followUpDueAt: { lte: new Date() },
                followUpMessage: null, // Only if we haven't already generated one
            },
            include: {
                creator: { select: { name: true, telegramId: true, telegramGroupId: true } },
                facts: { take: 5 },
                preferences: { take: 5 },
            },
            take: 50, // Process up to 50 per run
        });

        if (dueFans.length === 0) {
            return NextResponse.json({ ok: true, processed: 0 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        const results: any[] = [];

        for (const fan of dueFans) {
            try {
                // Determine follow-up type based on fan stage
                let followUpType = "check_in";
                if (fan.stage === "at_risk" || fan.stage === "churned") {
                    followUpType = "win_back";
                } else if (fan.stage === "active_buyer" || fan.stage === "warming") {
                    followUpType = "cliffhanger";
                }

                let followUpMessage = "";

                if (apiKey) {
                    // Generate personalized follow-up via GPT-4o-mini
                    const factsStr = fan.facts.map((f) => `${f.key}: ${f.value}`).join(", ") || "No facts";
                    const prefsStr = fan.preferences.map((p) => p.tag).join(", ") || "No preferences";

                    const prompt = `Generate a short follow-up message (under 30 words) for an OnlyFans fan.

Fan: ${fan.name || "Anonymous"}
Type: ${fan.fanType || "unknown"}
Tone preference: ${fan.tonePreference || "playful"}
Stage: ${fan.stage || "unknown"}
Follow-up type: ${followUpType}
Personal facts: ${factsStr}
Preferences: ${prefsStr}

Rules:
- "cliffhanger": Create curiosity/FOMO — hint at something exciting coming
- "check_in": Warm, personal — ask about their life using personal facts
- "win_back": Emotional hook — remind them what they're missing

Be flirty, natural, not desperate. Return ONLY the message text, no JSON.`;

                    const response = await fetch(OPENAI_BASE, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "gpt-4o-mini",
                            messages: [
                                { role: "system", content: "You are a flirty, charismatic OnlyFans creator writing follow-up messages. Keep it natural and conversational." },
                                { role: "user", content: prompt },
                            ],
                            temperature: 0.7,
                            max_tokens: 100,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        followUpMessage = data.choices?.[0]?.message?.content?.trim() || "";
                    }
                }

                // Fallback generic messages
                if (!followUpMessage) {
                    const fallbacks: Record<string, string> = {
                        cliffhanger: `Hey ${fan.name || "babe"}, I made something special today... want a sneak peek? 😏`,
                        check_in: `Hey ${fan.name || "babe"}, been thinking about you! How's your day going? 💕`,
                        win_back: `Miss you ${fan.name || "babe"}... I have some content I think you'd really love 🥺`,
                    };
                    followUpMessage = fallbacks[followUpType] || fallbacks.check_in;
                }

                // Update fan with follow-up message
                await prisma.fan.update({
                    where: { id: fan.id },
                    data: {
                        followUpType,
                        followUpMessage,
                    },
                });

                // Log lifecycle event
                await prisma.fanLifecycleEvent.create({
                    data: {
                        fanId: fan.id,
                        type: "followup_generated",
                        metadata: {
                            followUpType,
                            message: followUpMessage.slice(0, 100),
                            dueAt: fan.followUpDueAt?.toISOString(),
                        },
                    },
                });

                // Telegram ping
                if (TELEGRAM_BOT_TOKEN && fan.creator) {
                    const chatId = fan.creator.telegramGroupId || fan.creator.telegramId;
                    const msg = `⏰ Follow-up due: ${fan.name || "Fan"} (${fan.creator.name})\n\nType: ${followUpType}\nSuggested: "${followUpMessage.slice(0, 80)}..."`;
                    await fetch(
                        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ chat_id: chatId, text: msg }),
                        },
                    ).catch(console.error);
                }

                results.push({ fan: fan.name, type: followUpType, ok: true });
            } catch (e: any) {
                results.push({ fan: fan.name, error: e.message });
            }
        }

        return NextResponse.json({ ok: true, processed: results.length, results });
    } catch (e: any) {
        console.error("[Follow-ups] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

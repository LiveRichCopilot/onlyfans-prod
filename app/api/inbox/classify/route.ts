import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { classifyFan, stripHtml } from "@/lib/ai-classifier";
import type { IntentTag } from "@/lib/ai-classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/inbox/classify — Classify a fan from their recent messages
 *
 * Body: { creatorId, chatId, fanOfapiId, fanName? }
 *
 * 1. Fetches last 50 messages from OFAPI
 * 2. Filters to fan-only messages (not creator)
 * 3. Runs AI classifier (GPT-4o-mini)
 * 4. Saves results to Fan table + FanIntentEvent + FanPreference
 * 5. Returns classification result
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, chatId, fanOfapiId, fanName } = body;

        if (!creatorId || !chatId || !fanOfapiId) {
            return NextResponse.json({ error: "Missing creatorId, chatId, or fanOfapiId" }, { status: 400 });
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
        }

        // Find the creator
        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator || !creator.ofapiToken || creator.ofapiToken === "unlinked") {
            return NextResponse.json({ error: "Creator not linked" }, { status: 404 });
        }

        const accountName = creator.ofapiCreatorId || creator.telegramId;

        // --- 1. Fetch recent messages ---
        const msgRes = await getChatMessages(accountName, chatId, apiKey, 50);
        const rawMessages: any[] = msgRes?.data?.list || msgRes?.list || (Array.isArray(msgRes?.data) ? msgRes.data : []);

        if (rawMessages.length === 0) {
            return NextResponse.json({ classified: false, reason: "No messages found" });
        }

        // Get creator's own OF user ID to distinguish fan vs creator messages
        const creatorOfId = creator.ofapiCreatorId;

        // --- 2. Filter to fan-only messages ---
        const fanMessages = rawMessages
            .filter((m: any) => {
                const senderId = m.fromUser?.id?.toString();
                // It's a fan message if the sender is NOT the creator
                return senderId && senderId !== creatorOfId;
            })
            .map((m: any) => stripHtml(m.text || ""))
            .filter((text: string) => text.length > 2); // Skip empty/tiny messages

        if (fanMessages.length < 3) {
            return NextResponse.json({ classified: false, reason: "Not enough fan messages (need at least 3)" });
        }

        // --- 3. Run AI classification ---
        // Check API key before calling classifier
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ classified: false, reason: "OPENAI_API_KEY not set — add it in Vercel Settings → Environment Variables" });
        }

        const result = await classifyFan(fanMessages, fanName);

        if (!result) {
            return NextResponse.json({ classified: false, reason: "Classification failed — check Vercel logs for details" });
        }

        // --- 4. Save results to DB ---
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
        });

        if (fan) {
            // Update Fan record with classified fields
            const updates: Record<string, any> = {};

            if (result.fanType && result.confidence >= 0.6) {
                updates.fanType = result.fanType;
            }
            if (result.tonePreference && result.confidence >= 0.5) {
                updates.tonePreference = result.tonePreference;
            }
            if (result.emotionalDrivers.length > 0) {
                updates.emotionalDrivers = JSON.stringify(result.emotionalDrivers);
            }
            if (result.summary) {
                updates.narrativeSummary = result.summary;
            }

            // Compute intent score from detected intent tags
            const highIntentTags = result.intentTags.filter(t => t.confidence >= 0.6);
            if (highIntentTags.length > 0) {
                const maxIntent = Math.max(...highIntentTags.map(t => t.confidence));
                updates.intentScore = Math.round(maxIntent * 100);
                updates.lastIntentAt = new Date();
            }

            if (Object.keys(updates).length > 0) {
                await prisma.fan.update({
                    where: { id: fan.id },
                    data: updates,
                });
            }

            // Save intent events
            for (const intent of result.intentTags) {
                if (intent.confidence < 0.4) continue; // Skip low-confidence
                try {
                    await prisma.fanIntentEvent.create({
                        data: {
                            fanId: fan.id,
                            intentTag: intent.tag,
                            confidence: intent.confidence,
                            messageText: intent.evidence?.slice(0, 200) || null,
                        },
                    });
                } catch {
                    // Skip dupes or errors
                }
            }

            // Save preferences from buying keywords + emotional drivers
            for (const keyword of result.buyingKeywords) {
                try {
                    await prisma.fanPreference.upsert({
                        where: { fanId_tag: { fanId: fan.id, tag: keyword.toLowerCase() } },
                        create: {
                            fanId: fan.id,
                            tag: keyword.toLowerCase(),
                            weight: 1.0,
                            source: "auto",
                        },
                        update: {
                            weight: { increment: 0.3 },
                            lastSeenAt: new Date(),
                        },
                    });
                } catch {
                    // Skip
                }
            }

            // Log lifecycle event
            await prisma.fanLifecycleEvent.create({
                data: {
                    fanId: fan.id,
                    type: "ai_classification",
                    metadata: {
                        fanType: result.fanType,
                        tonePreference: result.tonePreference,
                        intentTags: result.intentTags.map(t => t.tag),
                        confidence: result.confidence,
                        messagesAnalyzed: fanMessages.length,
                    },
                },
            }).catch(() => {});
        }

        return NextResponse.json({
            classified: true,
            result,
            messagesAnalyzed: fanMessages.length,
            savedToDb: !!fan,
        });
    } catch (e: any) {
        console.error("Classification error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

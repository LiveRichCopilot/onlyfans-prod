import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { classifyFan, stripHtml } from "@/lib/ai-classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow more time for full history scan

/**
 * POST /api/inbox/classify — Classify a fan from their FULL chat history
 *
 * Body: { creatorId, chatId, fanOfapiId, fanName? }
 *
 * 1. Paginates through ALL messages (up to 1000)
 * 2. Filters to fan-only messages
 * 3. Runs AI classifier (GPT-4o-mini)
 * 4. Saves: Fan fields, FanIntentEvent, FanPreference, FanFact
 * 5. Returns classification result
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, chatId, fanOfapiId, fanName } = body;

        if (!creatorId || !chatId || !fanOfapiId) {
            return NextResponse.json({ error: "Missing creatorId, chatId, or fanOfapiId" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ classified: false, reason: "OPENAI_API_KEY not set — add it in Vercel Settings → Environment Variables" });
        }

        const apiKey = process.env.OFAPI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "OFAPI_API_KEY not configured" }, { status: 500 });
        }

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator?.ofapiCreatorId) {
            return NextResponse.json({ error: "Creator not linked" }, { status: 404 });
        }

        const accountName = creator.ofapiCreatorId;
        const creatorOfId = creator.ofapiCreatorId;

        // --- 1. Fetch ALL messages (paginate up to 1000) ---
        const allMessages: any[] = [];
        let cursor: string | undefined;
        const maxPages = 10; // 10 x 100 = 1000 messages

        for (let page = 0; page < maxPages; page++) {
            const res = await getChatMessages(accountName, chatId, apiKey, 100, cursor);
            const msgs: any[] = res?.data?.list || res?.list || (Array.isArray(res?.data) ? res.data : []);
            if (msgs.length === 0) break;

            allMessages.push(...msgs);

            // Get next cursor
            const nextLastId = res?.data?.nextLastId;
            const nextPage = res?._pagination?.next_page;
            if (nextLastId) {
                cursor = String(nextLastId);
            } else if (nextPage) {
                try {
                    const nextUrl = new URL(nextPage, "https://app.onlyfansapi.com");
                    cursor = nextUrl.searchParams.get("id") || undefined;
                } catch { break; }
            } else { break; }

            if (res?.data?.hasMore === false) break;
        }

        // --- 2. Filter to fan-only messages ---
        const fanMessages = allMessages
            .filter((m: any) => {
                const senderId = m.fromUser?.id?.toString();
                return senderId && senderId !== creatorOfId;
            })
            .map((m: any) => stripHtml(m.text || ""))
            .filter((text: string) => text.length > 2);

        if (fanMessages.length < 3) {
            return NextResponse.json({ classified: false, reason: `Not enough fan messages (found ${fanMessages.length}, need 3+)` });
        }

        // --- 3. Run AI classification ---
        const result = await classifyFan(fanMessages, fanName);

        if (!result) {
            return NextResponse.json({ classified: false, reason: "Classification failed — check Vercel logs" });
        }

        // --- 4. Save results to DB ---
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
        });

        if (fan) {
            // Update Fan record
            const updates: Record<string, any> = {};

            if (result.fanType && result.confidence >= 0.5) updates.fanType = result.fanType;
            if (result.tonePreference && result.confidence >= 0.4) updates.tonePreference = result.tonePreference;
            if (result.emotionalDrivers.length > 0) updates.emotionalDrivers = JSON.stringify(result.emotionalDrivers);
            if (result.summary) updates.narrativeSummary = result.summary;

            // Content preferences → formatPreference
            if (result.contentPreferences.length > 0) {
                updates.emotionalNeeds = JSON.stringify(result.contentPreferences); // Reuse field for content prefs
            }

            const highIntentTags = result.intentTags.filter(t => t.confidence >= 0.5);
            if (highIntentTags.length > 0) {
                updates.intentScore = Math.round(Math.max(...highIntentTags.map(t => t.confidence)) * 100);
                updates.lastIntentAt = new Date();
            }

            if (Object.keys(updates).length > 0) {
                await prisma.fan.update({ where: { id: fan.id }, data: updates });
            }

            // Save intent events
            for (const intent of result.intentTags.filter(t => t.confidence >= 0.4)) {
                await prisma.fanIntentEvent.create({
                    data: {
                        fanId: fan.id,
                        intentTag: intent.tag,
                        confidence: intent.confidence,
                        messageText: intent.evidence?.slice(0, 200) || null,
                    },
                }).catch(() => {});
            }

            // Save content preferences + buying keywords as FanPreference tags
            const allTags = [
                ...result.contentPreferences.map(t => t.toLowerCase()),
                ...result.buyingKeywords.map(t => t.toLowerCase()),
            ];
            for (const tag of [...new Set(allTags)]) {
                await prisma.fanPreference.upsert({
                    where: { fanId_tag: { fanId: fan.id, tag } },
                    create: { fanId: fan.id, tag, weight: 1.0, source: "auto" },
                    update: { weight: { increment: 0.3 }, lastSeenAt: new Date() },
                }).catch(() => {});
            }

            // Save personal facts to FanFact table
            for (const fact of result.personalFacts || []) {
                if (!fact.key || !fact.value) continue;
                const cleanKey = fact.key.toLowerCase().replace(/\s+/g, "_");
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key: cleanKey } },
                    create: {
                        fanId: fan.id,
                        key: cleanKey,
                        value: fact.value,
                        confidence: 0.8,
                        source: "auto",
                    },
                    update: {
                        value: fact.value,
                        lastConfirmedAt: new Date(),
                    },
                }).catch(() => {});
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
                        personalFacts: (result.personalFacts || []).length,
                        contentPreferences: result.contentPreferences,
                        confidence: result.confidence,
                        messagesAnalyzed: fanMessages.length,
                        totalMessagesScanned: allMessages.length,
                    },
                },
            }).catch(() => {});
        }

        return NextResponse.json({
            classified: true,
            result,
            messagesAnalyzed: fanMessages.length,
            totalMessagesScanned: allMessages.length,
            savedToDb: !!fan,
        });
    } catch (e: any) {
        console.error("Classification error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

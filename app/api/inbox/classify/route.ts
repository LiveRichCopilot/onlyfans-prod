import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { classifyFan, stripHtml } from "@/lib/ai-classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/inbox/classify — Classify a fan using strategic message windows
 *
 * Three-window scan strategy (Jay's approach):
 * 1. FIRST 100 messages ever — who is this person, how did it start
 * 2. 20 messages around every purchase — what triggered each buy
 * 3. LAST 400 messages — current mood, recent interests, what's working
 *
 * This gives deep understanding without scanning every single message.
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

        // --- STEP 1: Paginate through ALL messages to build the full timeline ---
        // OFAPI returns newest first (order=desc), so we paginate backward
        const allMessages: any[] = [];
        let cursor: string | undefined;
        const maxPages = 50; // Up to 5000 messages — covers most conversations

        for (let page = 0; page < maxPages; page++) {
            const res = await getChatMessages(accountName, chatId, apiKey, 100, cursor);
            const msgs: any[] = res?.data?.list || res?.list || (Array.isArray(res?.data) ? res.data : []);
            if (msgs.length === 0) break;

            allMessages.push(...msgs);

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

        if (allMessages.length < 5) {
            return NextResponse.json({ classified: false, reason: `Not enough messages (found ${allMessages.length})` });
        }

        // Sort chronologically (oldest first) for windowing
        allMessages.sort((a: any, b: any) =>
            new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );

        // --- STEP 2: Build the three strategic windows ---

        // Window 1: FIRST 100 messages ever (oldest)
        const firstWindow = allMessages.slice(0, 100);

        // Window 2: 20 messages around every purchase (price > 0 and isOpened)
        const purchaseIndices: number[] = [];
        for (let i = 0; i < allMessages.length; i++) {
            const msg = allMessages[i];
            const price = Number(msg.price) || 0;
            if (price > 0 || msg.isTip === true) {
                purchaseIndices.push(i);
            }
        }

        const purchaseWindow: any[] = [];
        const purchaseWindowIds = new Set<string>();
        for (const idx of purchaseIndices) {
            const start = Math.max(0, idx - 10); // 10 before
            const end = Math.min(allMessages.length, idx + 11); // 10 after + the purchase itself
            for (let i = start; i < end; i++) {
                const msgId = String(allMessages[i].id);
                if (!purchaseWindowIds.has(msgId)) {
                    purchaseWindowIds.add(msgId);
                    purchaseWindow.push(allMessages[i]);
                }
            }
        }

        // Window 3: LAST 400 messages (newest)
        const lastWindow = allMessages.slice(-400);

        // --- STEP 3: Deduplicate and merge all windows ---
        const mergedIds = new Set<string>();
        const mergedMessages: any[] = [];

        const addToMerged = (msgs: any[], label: string) => {
            for (const m of msgs) {
                const id = String(m.id);
                if (!mergedIds.has(id)) {
                    mergedIds.add(id);
                    mergedMessages.push({ ...m, _window: label });
                }
            }
        };

        addToMerged(firstWindow, "first_100");
        addToMerged(purchaseWindow, "around_purchases");
        addToMerged(lastWindow, "last_400");

        // Sort merged chronologically
        mergedMessages.sort((a: any, b: any) =>
            new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );

        // --- STEP 4: Filter to fan-only messages and strip HTML ---
        const fanMessages = mergedMessages
            .filter((m: any) => {
                const senderId = m.fromUser?.id?.toString();
                return senderId && senderId !== creatorOfId;
            })
            .map((m: any) => {
                const text = stripHtml(m.text || "");
                const price = Number(m.price) || 0;
                const isTip = m.isTip === true;
                // Annotate purchase messages so the AI knows what triggered a buy
                if (price > 0 && m.isOpened) return `[PURCHASED $${price}] ${text}`;
                if (price > 0) return `[PPV SENT $${price}] ${text}`;
                if (isTip) return `[TIPPED] ${text}`;
                return text;
            })
            .filter((text: string) => text.length > 2);

        if (fanMessages.length < 3) {
            return NextResponse.json({
                classified: false,
                reason: `Not enough fan messages (found ${fanMessages.length} from ${mergedMessages.length} total)`,
            });
        }

        // --- STEP 5: Run AI classification ---
        const result = await classifyFan(fanMessages, fanName);

        if (!result) {
            return NextResponse.json({ classified: false, reason: "Classification failed — check Vercel logs" });
        }

        // --- STEP 6: Save everything to DB ---
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
            if (result.contentPreferences.length > 0) updates.emotionalNeeds = JSON.stringify(result.contentPreferences);

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

            // Save content preferences + buying keywords
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

            // Save personal facts
            for (const fact of result.personalFacts || []) {
                if (!fact.key || !fact.value) continue;
                const cleanKey = fact.key.toLowerCase().replace(/\s+/g, "_");
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key: cleanKey } },
                    create: { fanId: fan.id, key: cleanKey, value: fact.value, confidence: 0.8, source: "auto" },
                    update: { value: fact.value, lastConfirmedAt: new Date() },
                }).catch(() => {});
            }

            // Log lifecycle event
            await prisma.fanLifecycleEvent.create({
                data: {
                    fanId: fan.id,
                    type: "ai_classification",
                    metadata: {
                        fanType: result.fanType,
                        personalFactsCount: (result.personalFacts || []).length,
                        contentPreferences: result.contentPreferences,
                        confidence: result.confidence,
                        windows: {
                            first100: firstWindow.length,
                            aroundPurchases: purchaseWindow.length,
                            last400: lastWindow.length,
                            merged: mergedMessages.length,
                            fanOnly: fanMessages.length,
                        },
                        totalHistory: allMessages.length,
                        purchasesFound: purchaseIndices.length,
                    },
                },
            }).catch(() => {});
        }

        return NextResponse.json({
            classified: true,
            result,
            windows: {
                first100: firstWindow.length,
                aroundPurchases: purchaseWindow.length,
                purchasesFound: purchaseIndices.length,
                last400: lastWindow.length,
                totalMerged: mergedMessages.length,
                fanMessagesAnalyzed: fanMessages.length,
                totalHistory: allMessages.length,
            },
            savedToDb: !!fan,
        });
    } catch (e: any) {
        console.error("Classification error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

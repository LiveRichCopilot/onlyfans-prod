import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { classifyFan, stripHtml } from "@/lib/ai-classifier";
import type { AnalysisMetadata, ClassificationResult, PersonalFact } from "@/lib/ai-classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Budget: 30s max (was 60, timed out)

// --- FIX #1: Normalize OFAPI response shape ---
// Confirmed shape: { data: Message[], _pagination: { next_page: "url" } }
// But handle edge cases defensively
function extractMessages(res: any): any[] {
    const list = res?.data?.list ?? res?.list ?? res?.data;
    return Array.isArray(list) ? list : [];
}

function extractPaginationCursor(res: any): string | undefined {
    const nextPage = res?._pagination?.next_page;
    if (!nextPage || typeof nextPage !== "string") return undefined;
    try {
        const nextUrl = new URL(nextPage, "https://app.onlyfansapi.com");
        return nextUrl.searchParams.get("id") || undefined;
    } catch {
        return undefined;
    }
}

/**
 * POST /api/inbox/classify — Classify a fan using windowed message fetch
 *
 * Strategy (4 OFAPI calls instead of 50):
 * 1. Early window:  order=asc, limit=100  → first 100 messages (1 call)
 * 2. Recent window: order=desc, limit=100 → 3 pages max (3 calls)
 * 3. Purchase context: detected from already-fetched messages (0 calls)
 *
 * On re-analysis (cursor exists):
 *   Only fetch messages newer than lastAnalyzedMessageId
 *   Merge with existing facts — don't redo work
 *
 * Budget: max 6 API calls, max 400 messages, max 30s
 */
export async function POST(request: Request) {
    const startTime = Date.now();
    let apiCallsMade = 0;

    try {
        const body = await request.json();
        const { creatorId, chatId, fanOfapiId: rawFanId, fanName } = body;
        const fanOfapiId = rawFanId != null ? String(rawFanId) : null;

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

        // --- STEP 1: Read existing facts (don't redo work) ---
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
            include: { facts: true },
        });

        const existingFacts: PersonalFact[] = (fan?.facts || []).map(f => ({
            key: f.key,
            value: f.value,
            confidence: f.confidence,
        }));

        const isIncremental = !!fan?.lastAnalyzedMessageId;
        const storedCursor = fan?.lastAnalyzedMessageId || undefined;

        // --- STEP 2: Windowed fetch (4 calls max for first scan, fewer for incremental) ---
        const earlyMessages: any[] = [];
        const recentMessages: any[] = [];

        // Budget constants
        const MAX_API_CALLS = 6;
        const MAX_MESSAGES = 400;
        const HARD_DEADLINE_MS = 25000; // Bail at 25s so we can return a response before Vercel's 30s kill
        const isOverBudget = () => Date.now() - startTime > HARD_DEADLINE_MS;

        // EARLY WINDOW: order=asc, limit=100 (skip on incremental — we already have early context via existingFacts)
        if (!isIncremental) {
            try {
                const earlyRes = await getChatMessages(accountName, chatId, apiKey, 100, undefined, "asc");
                apiCallsMade++;
                earlyMessages.push(...extractMessages(earlyRes));
            } catch (e: any) {
                console.warn("[Classify] Early window fetch failed:", e.message);
                // Continue without early window — recent window is more important
            }
        }

        // RECENT WINDOW: order=desc, limit=100, up to 3 pages
        // On incremental: stop when we hit the stored cursor
        let recentPageCursor: string | undefined;
        const maxRecentPages = 3;
        let cursorFound = false;

        for (let page = 0; page < maxRecentPages && apiCallsMade < MAX_API_CALLS && !isOverBudget(); page++) {
            let res;
            try {
                res = await getChatMessages(accountName, chatId, apiKey, 100, recentPageCursor, "desc");
            } catch (e: any) {
                console.warn(`[Classify] Recent window page ${page} failed:`, e.message);
                break; // Stop paging on error — use what we have
            }
            apiCallsMade++;
            const msgs = extractMessages(res);
            if (msgs.length === 0) break;

            // FIX #2: On incremental — stop at stored cursor, handle cursor-not-found gracefully
            if (isIncremental && storedCursor) {
                const cursorIdx = msgs.findIndex((m: any) => String(m.id) === storedCursor);
                if (cursorIdx >= 0) {
                    // Only take messages newer than cursor (before it in desc order)
                    recentMessages.push(...msgs.slice(0, cursorIdx));
                    cursorFound = true;
                    break;
                }
            }

            recentMessages.push(...msgs);

            // Get next page cursor from _pagination
            recentPageCursor = extractPaginationCursor(res);
            if (!recentPageCursor) break;

            if (earlyMessages.length + recentMessages.length >= MAX_MESSAGES) break;
        }

        // --- STEP 3: Merge & deduplicate, cap to MAX_MESSAGES ---
        const mergedIds = new Set<string>();
        const allMessages: any[] = [];

        const addUnique = (msgs: any[]) => {
            for (const m of msgs) {
                if (allMessages.length >= MAX_MESSAGES) break;
                const id = String(m.id);
                if (!mergedIds.has(id)) {
                    mergedIds.add(id);
                    allMessages.push(m);
                }
            }
        };

        addUnique(earlyMessages);
        addUnique(recentMessages);

        // Sort chronologically (oldest first)
        allMessages.sort((a: any, b: any) =>
            new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );

        if (allMessages.length < 3) {
            return NextResponse.json({
                classified: false,
                reason: `Not enough messages (found ${allMessages.length})`,
            });
        }

        // --- STEP 4: Detect purchases from already-fetched messages (0 extra calls) ---
        let purchaseContextCount = 0;
        for (const msg of allMessages) {
            const price = Number(msg.price) || 0;
            if (price > 0 || msg.isTip === true) purchaseContextCount++;
        }

        // --- STEP 5: Filter to fan-only messages and strip HTML ---
        const fanMessages = allMessages
            .filter((m: any) => {
                const senderId = m.fromUser?.id?.toString();
                return senderId && senderId !== creatorOfId;
            })
            .map((m: any) => {
                const text = stripHtml(m.text || "");
                const price = Number(m.price) || 0;
                const isTip = m.isTip === true;
                if (price > 0 && m.isOpened) return `[PURCHASED $${price}] ${text}`;
                if (price > 0) return `[PPV SENT $${price}] ${text}`;
                if (isTip) return `[TIPPED] ${text}`;
                return text;
            })
            .filter((text: string) => text.length > 2);

        if (fanMessages.length < 3) {
            return NextResponse.json({
                classified: false,
                reason: `Not enough fan messages (found ${fanMessages.length} from ${allMessages.length} total)`,
            });
        }

        // --- STEP 6: Get newest message ID for cursor ---
        // FIX #4: Use newest by createdAt (not just first in desc array)
        const newestMsg = recentMessages.length > 0
            ? recentMessages.reduce((a: any, b: any) =>
                new Date(a.createdAt).getTime() > new Date(b.createdAt).getTime() ? a : b)
            : allMessages[allMessages.length - 1];
        const newestMsgId = newestMsg?.id ? String(newestMsg.id) : undefined;
        const newestMsgAt = newestMsg?.createdAt || undefined;

        // --- STEP 7: Run AI classification (with existing facts context) ---
        if (isOverBudget()) {
            return NextResponse.json({
                classified: false,
                reason: `OFAPI calls took too long (${Math.round((Date.now() - startTime) / 1000)}s) — try again when OFAPI is faster`,
                runtimeMs: Date.now() - startTime,
                apiCallsMade,
            });
        }
        // FIX #3: On incremental, existingFacts are passed so the model has early context even without early window
        const remainingMs = HARD_DEADLINE_MS - (Date.now() - startTime);
        console.log(`[Classify] Calling OpenAI: ${fanMessages.length} fan msgs, ${remainingMs}ms budget remaining, ${apiCallsMade} API calls made`);
        const result = await classifyFan(fanMessages, fanName, existingFacts, Math.max(remainingMs, 5000));

        if (!result) {
            return NextResponse.json({
                classified: false,
                reason: "Classification returned null — OpenAI may have timed out or returned an error",
                debug: {
                    fanMessagesCount: fanMessages.length,
                    totalMessagesFound: allMessages.length,
                    earlyWindowCount: earlyMessages.length,
                    recentWindowCount: recentMessages.length,
                    apiCallsMade,
                    runtimeMs: Date.now() - startTime,
                    remainingMsForOpenAI: remainingMs,
                    openAiKeySet: !!process.env.OPENAI_API_KEY,
                },
            });
        }

        // Build full result with analysis metadata
        const analysis: AnalysisMetadata = {
            earlyWindowCount: earlyMessages.length,
            recentWindowCount: recentMessages.length,
            purchaseContextCount,
            totalMessagesUsed: allMessages.length,
            lastMessageIdUsed: newestMsgId,
            lastMessageAtUsed: newestMsgAt,
            apiCallsMade,
            runtimeMs: Date.now() - startTime,
            isIncremental,
        };

        const fullResult: ClassificationResult = { ...result, analysis };

        // --- STEP 8: Save to DB ---
        if (fan) {
            // Update Fan record with classification + cursor
            const updates: Record<string, any> = {
                lastAnalyzedMessageId: newestMsgId || fan.lastAnalyzedMessageId,
                lastAnalyzedAt: new Date(),
                messagesAnalyzed: allMessages.length,
            };

            if (result.fanType && result.confidence >= 0.5) updates.fanType = result.fanType;
            if (result.tonePreference && result.confidence >= 0.4) updates.tonePreference = result.tonePreference;
            if (result.emotionalDrivers.length > 0) updates.emotionalDrivers = JSON.stringify(result.emotionalDrivers);
            if (result.summary) updates.narrativeSummary = result.summary;
            if (result.contentPreferences.length > 0) updates.emotionalNeeds = JSON.stringify(result.contentPreferences);
            if (result.relationshipStatus) updates.relationshipStatus = result.relationshipStatus;
            if (result.job) updates.occupationCategory = result.job;

            const highIntentTags = result.intentTags.filter(t => t.confidence >= 0.5);
            if (highIntentTags.length > 0) {
                updates.intentScore = Math.round(Math.max(...highIntentTags.map(t => t.confidence)) * 100);
                updates.lastIntentAt = new Date();
            }

            await prisma.fan.update({ where: { id: fan.id }, data: updates });

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

            // Save facts to FanFact table (upsert — update if key exists, no duplicates)
            for (const fact of result.facts) {
                if (!fact.key || !fact.value) continue;
                const cleanKey = fact.key.toLowerCase().replace(/\s+/g, "_");
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key: cleanKey } },
                    create: { fanId: fan.id, key: cleanKey, value: fact.value, confidence: fact.confidence || 0.8, source: "auto" },
                    update: { value: fact.value, lastConfirmedAt: new Date() },
                }).catch(() => {});
            }

            // Save top-level personal fields as facts too (so they persist in FanFact table)
            const topLevelFacts: [string, string | null][] = [
                ["nickname", result.nickname],
                ["location", result.location],
                ["job", result.job],
                ["relationship_status", result.relationshipStatus],
            ];
            for (const [key, value] of topLevelFacts) {
                if (!value) continue;
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key } },
                    create: { fanId: fan.id, key, value, confidence: 0.8, source: "auto" },
                    update: { value, lastConfirmedAt: new Date() },
                }).catch(() => {});
            }
            // Save arrays as comma-joined facts
            if (result.pets.length > 0) {
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key: "pets" } },
                    create: { fanId: fan.id, key: "pets", value: result.pets.join(", "), confidence: 0.8, source: "auto" },
                    update: { value: result.pets.join(", "), lastConfirmedAt: new Date() },
                }).catch(() => {});
            }
            if (result.hobbies.length > 0) {
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key: "hobbies" } },
                    create: { fanId: fan.id, key: "hobbies", value: result.hobbies.join(", "), confidence: 0.8, source: "auto" },
                    update: { value: result.hobbies.join(", "), lastConfirmedAt: new Date() },
                }).catch(() => {});
            }

            // Save doNotForget as a special fact
            if (result.doNotForget.length > 0) {
                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key: "do_not_forget" } },
                    create: { fanId: fan.id, key: "do_not_forget", value: JSON.stringify(result.doNotForget), confidence: 1.0, source: "auto" },
                    update: { value: JSON.stringify(result.doNotForget), lastConfirmedAt: new Date() },
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

            // Log lifecycle event
            await prisma.fanLifecycleEvent.create({
                data: {
                    fanId: fan.id,
                    type: "ai_classification",
                    metadata: {
                        isIncremental,
                        cursorFound: isIncremental ? cursorFound : null,
                        confidence: result.confidence,
                        fanType: result.fanType,
                        factsExtracted: result.facts.length,
                        suggestedQuestions: result.suggestedQuestions,
                        analysis,
                    },
                },
            }).catch(() => {});
        }

        return NextResponse.json({
            classified: true,
            result: fullResult,
            savedToDb: !!fan,
        });
    } catch (e: any) {
        console.error("Classification error:", e.message);
        return NextResponse.json({
            error: e.message,
            runtimeMs: Date.now() - startTime,
            apiCallsMade,
        }, { status: 500 });
    }
}

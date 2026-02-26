import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { classifyFan, stripHtml } from "@/lib/ai-classifier";
import type { AnalysisMetadata, ClassificationResult, PersonalFact } from "@/lib/ai-classifier";
import { saveClassificationToDb } from "@/lib/classify-persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator?.ofapiCreatorId || !creator?.ofapiToken) {
            return NextResponse.json({ error: "Creator not linked or missing OFAPI token" }, { status: 404 });
        }

        const accountName = creator.ofapiCreatorId;
        const creatorOfId = creator.ofapiCreatorId;
        const apiKey = creator.ofapiToken;

        // --- STEP 1: Read existing facts ---
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
            include: { facts: true },
        });

        const existingFacts: PersonalFact[] = (fan?.facts || []).map(f => ({
            key: f.key, value: f.value, confidence: f.confidence,
        }));

        const isIncremental = !!fan?.lastAnalyzedMessageId;
        const storedCursor = fan?.lastAnalyzedMessageId || undefined;

        // --- STEP 2: Windowed fetch ---
        const earlyMessages: any[] = [];
        const recentMessages: any[] = [];

        const MAX_API_CALLS = 4;
        const MAX_MESSAGES = 400;
        const HARD_DEADLINE_MS = 55000;
        const OFAPI_DEADLINE_MS = 25000;
        const isOfapiOverBudget = () => Date.now() - startTime > OFAPI_DEADLINE_MS;

        if (!isIncremental) {
            try {
                const earlyRes = await getChatMessages(accountName, chatId, apiKey, 50, undefined, "asc");
                apiCallsMade++;
                earlyMessages.push(...extractMessages(earlyRes));
            } catch (e: any) {
                console.warn("[Classify] Early window fetch failed:", e.message);
            }
        }

        let recentPageCursor: string | undefined;
        let cursorFound = false;

        for (let page = 0; page < 3 && apiCallsMade < MAX_API_CALLS && !isOfapiOverBudget(); page++) {
            let res;
            try {
                res = await getChatMessages(accountName, chatId, apiKey, 100, recentPageCursor, "desc");
            } catch (e: any) {
                console.warn(`[Classify] Recent window page ${page} failed:`, e.message);
                break;
            }
            apiCallsMade++;
            const msgs = extractMessages(res);
            if (msgs.length === 0) break;

            if (isIncremental && storedCursor) {
                const cursorIdx = msgs.findIndex((m: any) => String(m.id) === storedCursor);
                if (cursorIdx >= 0) {
                    recentMessages.push(...msgs.slice(0, cursorIdx));
                    cursorFound = true;
                    break;
                }
            }

            recentMessages.push(...msgs);
            recentPageCursor = extractPaginationCursor(res);
            if (!recentPageCursor) break;
            if (earlyMessages.length + recentMessages.length >= MAX_MESSAGES) break;
        }

        // --- STEP 3: Merge & deduplicate ---
        const mergedIds = new Set<string>();
        const allMessages: any[] = [];

        const addUnique = (msgs: any[]) => {
            for (const m of msgs) {
                if (allMessages.length >= MAX_MESSAGES) break;
                const id = String(m.id);
                if (!mergedIds.has(id)) { mergedIds.add(id); allMessages.push(m); }
            }
        };
        addUnique(earlyMessages);
        addUnique(recentMessages);

        allMessages.sort((a: any, b: any) =>
            new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );

        if (!isIncremental && allMessages.length < 3) {
            return NextResponse.json({ classified: false, reason: `Not enough messages (found ${allMessages.length})` });
        }
        if (isIncremental && allMessages.length === 0) {
            return NextResponse.json({ classified: false, reason: "No new messages since last analysis" });
        }

        // --- STEP 4: Detect purchases ---
        let purchaseContextCount = 0;
        for (const msg of allMessages) {
            const price = Number(msg.price) || 0;
            if (price > 0 || msg.isTip === true) purchaseContextCount++;
        }

        // --- STEP 5: Filter to fan-only messages ---
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

        if (!isIncremental && fanMessages.length < 3) {
            return NextResponse.json({ classified: false, reason: `Not enough fan messages (found ${fanMessages.length} from ${allMessages.length} total)` });
        }
        if (isIncremental && fanMessages.length === 0 && existingFacts.length === 0) {
            return NextResponse.json({ classified: false, reason: "No new fan messages and no existing facts to update" });
        }

        // --- STEP 6: Get newest message ID ---
        const newestMsg = recentMessages.length > 0
            ? recentMessages.reduce((a: any, b: any) =>
                new Date(a.createdAt).getTime() > new Date(b.createdAt).getTime() ? a : b)
            : allMessages[allMessages.length - 1];
        const newestMsgId = newestMsg?.id ? String(newestMsg.id) : undefined;
        const newestMsgAt = newestMsg?.createdAt || undefined;

        // --- STEP 7: Run AI classification ---
        if (Date.now() - startTime > HARD_DEADLINE_MS) {
            return NextResponse.json({
                classified: false,
                reason: `Ran out of time (${Math.round((Date.now() - startTime) / 1000)}s) — OFAPI was slow, try again`,
                runtimeMs: Date.now() - startTime, apiCallsMade,
            });
        }

        const cappedFanMessages = fanMessages.slice(-80);
        const remainingMs = HARD_DEADLINE_MS - (Date.now() - startTime);
        console.log(`[Classify] Calling OpenAI: ${cappedFanMessages.length} fan msgs (capped from ${fanMessages.length}), ${remainingMs}ms budget remaining, ${apiCallsMade} API calls made`);
        const result = await classifyFan(cappedFanMessages, fanName, existingFacts, Math.max(remainingMs, 5000));

        if (!result) {
            return NextResponse.json({
                classified: true,
                result: {
                    fanType: "unknown", tonePreference: null, emotionalDrivers: [], nickname: null,
                    location: null, job: null, relationshipStatus: null, pets: [], hobbies: [],
                    facts: [], intentTags: [], buyingKeywords: [], contentPreferences: [],
                    confidence: 0,
                    summary: "Classification timed out — try again or check account sync",
                    suggestedQuestions: [], doNotForget: [],
                    analysis: {
                        earlyWindowCount: earlyMessages.length, recentWindowCount: recentMessages.length,
                        purchaseContextCount, totalMessagesUsed: allMessages.length,
                        lastMessageIdUsed: newestMsgId, lastMessageAtUsed: newestMsgAt,
                        apiCallsMade, runtimeMs: Date.now() - startTime, isIncremental,
                    },
                },
                savedToDb: false, fallback: true,
            });
        }

        const analysis: AnalysisMetadata = {
            earlyWindowCount: earlyMessages.length, recentWindowCount: recentMessages.length,
            purchaseContextCount, totalMessagesUsed: allMessages.length,
            lastMessageIdUsed: newestMsgId, lastMessageAtUsed: newestMsgAt,
            apiCallsMade, runtimeMs: Date.now() - startTime, isIncremental,
        };

        const fullResult: ClassificationResult = { ...result, analysis };

        // --- STEP 8: Save to DB ---
        if (fan) {
            await saveClassificationToDb(fan, result, newestMsgId, isIncremental, cursorFound, allMessages.length);
        }

        return NextResponse.json({ classified: true, result: fullResult, savedToDb: !!fan });
    } catch (e: any) {
        console.error("Classification error:", e.message);
        return NextResponse.json({ error: e.message, runtimeMs: Date.now() - startTime, apiCallsMade }, { status: 500 });
    }
}

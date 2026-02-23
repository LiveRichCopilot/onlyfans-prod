import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    getClosingHints,
    getCachedHints,
    setCachedHints,
    buildCacheKey,
    checkRateLimit,
} from "@/lib/ai-closing-hints";
import { buildContextBundle, compressBundle } from "@/lib/ai-context-bundle";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * POST /api/inbox/ai-hints (v2)
 *
 * Body: { creatorId, chatId, fanOfapiId }
 *
 * Production-hardened:
 * - Auth/tenancy: validates creator exists and has OFAPI token
 * - Cache: keyed by creatorId+chatId+lastMessageTs (invalidates on new message)
 * - Rate limit: 1 req per 10s per chat (best-effort in serverless)
 * - Context: uses ai-context-bundle for smart retrieval (not "last 20 msgs")
 * - Confidence: adjusted by context quality, missingContext[] reported
 * - Instrumentation: logs token usage for cost tracking
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, chatId, fanOfapiId } = body;

        if (!creatorId || !chatId || !fanOfapiId) {
            return NextResponse.json(
                { error: "Missing creatorId, chatId, or fanOfapiId" },
                { status: 400 },
            );
        }

        // --- Auth / Tenancy Validation ---
        // Verify the creator exists, is active, and has a valid OFAPI token
        const creator = await prisma.creator.findUnique({
            where: { id: creatorId },
        });

        if (!creator) {
            return NextResponse.json({ error: "Creator not found" }, { status: 404 });
        }
        if (!creator.ofapiToken || !creator.ofapiCreatorId) {
            return NextResponse.json({ error: "Creator not configured with OFAPI" }, { status: 400 });
        }

        // Verify the fan belongs to this creator (prevents cross-creator data leakage)
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
            include: {
                preferences: { orderBy: { weight: "desc" }, take: 20 },
                facts: { orderBy: { lastConfirmedAt: "desc" }, take: 25 },
            },
        });

        // --- Rate Limiting ---
        const rateLimitKey = `${creatorId}:${chatId}`;
        if (!checkRateLimit(rateLimitKey)) {
            // Return cached result if available, otherwise 429
            const anyCacheKey = buildCacheKey(creatorId, chatId);
            const cached = getCachedHints(anyCacheKey);
            if (cached) {
                return NextResponse.json({ hints: cached, cached: true, rateLimited: true });
            }
            return NextResponse.json(
                { error: "Rate limited — try again in 10 seconds" },
                { status: 429 },
            );
        }

        // --- Cache Check ---
        // Key includes lastMessageAt so new inbound messages invalidate
        const lastMsgTs = fan?.lastMessageAt?.toISOString() || "none";
        const cacheKey = buildCacheKey(creatorId, chatId, lastMsgTs);
        const cached = getCachedHints(cacheKey);
        if (cached) {
            return NextResponse.json({ hints: cached, cached: true });
        }

        // --- Build Context Bundle (smart retrieval) ---
        const bundle = await buildContextBundle({
            creatorId,
            chatId,
            fanOfapiId,
            accountName: creator.ofapiCreatorId,
            apiKey: creator.ofapiToken,
        });

        // Compress to fit token budget
        const compressedContext = compressBundle(bundle);

        // --- Build Intelligence Object ---
        const intelligence = fan
            ? {
                  stage: fan.stage,
                  fanType: fan.fanType,
                  tonePreference: fan.tonePreference,
                  priceRange: fan.priceRange,
                  intentScore: fan.intentScore,
                  emotionalDrivers: fan.emotionalDrivers,
                  emotionalNeeds: fan.emotionalNeeds,
                  nextBestAction: fan.nextBestAction,
                  nextBestActionReason: fan.nextBestActionReason,
                  lastMessageAt: fan.lastMessageAt?.toISOString() || null,
                  buyerType: fan.buyerType,
                  lastObjection: fan.lastObjection,
                  topObjection: fan.topObjection,
                  formatPreference: fan.formatPreference,
              }
            : null;

        // --- Get AI Hints ---
        const hints = await getClosingHints({
            fanName: fan?.name || undefined,
            intelligence,
            compressedContext,
            contextQuality: bundle.contextQuality,
            missingContext: bundle.missingContext,
        });

        if (!hints) {
            return NextResponse.json({ error: "AI hints generation failed" }, { status: 500 });
        }

        // --- Cache Result ---
        setCachedHints(cacheKey, hints);

        // --- Instrumentation: Log for cost tracking + Phase 3/5 scoring ---
        if (hints.tokenUsage) {
            console.log(`[AI Hints] tokens=${hints.tokenUsage.total} quality=${bundle.contextQuality} confidence=${hints.confidence.toFixed(2)} creator=${creator.name} fan=${fan?.name || "unknown"}`);
        }

        // Store hint record for instrumentation (what AI suggested vs what was sent)
        // This enables Phase 3 cue accuracy scoring and Phase 5 QA
        if (fan) {
            prisma.fanLifecycleEvent.create({
                data: {
                    fanId: fan.id,
                    type: "ai_hint_generated",
                    metadata: {
                        strikeZone: hints.strikeZone,
                        confidence: hints.confidence,
                        contextQuality: bundle.contextQuality,
                        hasBuyCue: hints.buyCue.detected,
                        hasBridge: hints.personalBridge.detected,
                        hasObjection: hints.objectionSniper.detected,
                        draftLength: hints.draftMessage.length,
                        tokenUsage: hints.tokenUsage?.total,
                        missingContext: bundle.missingContext,
                    },
                },
            }).catch(() => {}); // Fire-and-forget, non-critical
        }

        return NextResponse.json({ hints, cached: false });
    } catch (e: any) {
        console.error("[AI Hints] Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}

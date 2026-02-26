/**
 * Persist AI classification results to database.
 * Extracted from /api/inbox/classify to keep the route under 400 lines.
 */

import { prisma } from "@/lib/prisma";
import type { ClassificationResult, AnalysisMetadata, PersonalFact } from "@/lib/ai-classifier";

export async function saveClassificationToDb(
    fan: { id: string },
    result: Omit<ClassificationResult, "analysis">,
    newestMsgId: string | undefined,
    isIncremental: boolean,
    cursorFound: boolean,
    allMessagesLength: number,
) {
    // Update Fan record with classification + cursor
    const updates: Record<string, any> = {
        lastAnalyzedMessageId: newestMsgId || undefined,
        lastAnalyzedAt: new Date(),
        messagesAnalyzed: allMessagesLength,
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

    // Save top-level personal fields as facts too
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
            },
        },
    }).catch(() => {});
}

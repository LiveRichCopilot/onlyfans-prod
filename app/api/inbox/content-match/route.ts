import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/content-match?fanOfapiId=xxx&creatorId=xxx
 *
 * Matches fan preferences against tagged vault content.
 * Filters out already-sent media (double-sell prevention).
 * Returns ranked suggestions with match scores.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fanOfapiId = searchParams.get("fanOfapiId");
    const creatorId = searchParams.get("creatorId");

    if (!fanOfapiId || !creatorId) {
        return NextResponse.json({ error: "Missing fanOfapiId or creatorId" }, { status: 400 });
    }

    try {
        // Get fan preferences
        const fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
            include: {
                preferences: { orderBy: { weight: "desc" }, take: 20 },
            },
        });

        if (!fan) {
            return NextResponse.json({ error: "Fan not found" }, { status: 404 });
        }

        // Get all tagged vault media for this creator
        const assets = await prisma.mediaAsset.findMany({
            where: {
                creatorId,
                vaultTags: { not: null },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        // Build preference tag set with weights
        const prefMap = new Map<string, number>();
        for (const pref of fan.preferences) {
            prefMap.set(pref.tag.toLowerCase(), pref.weight);
        }

        // Score each asset against fan preferences
        const scored = assets.map((asset) => {
            const tags: string[] = asset.vaultTags ? JSON.parse(asset.vaultTags) : [];
            const sentTo: string[] = asset.sentToFanIds ? JSON.parse(asset.sentToFanIds) : [];
            const alreadySent = sentTo.includes(fanOfapiId);

            // Calculate match score
            let score = 0;
            const matchedTags: string[] = [];
            for (const tag of tags) {
                const weight = prefMap.get(tag.toLowerCase());
                if (weight) {
                    score += weight;
                    matchedTags.push(tag);
                }
            }

            // Bonus for matching price range
            if (fan.priceRange && asset.priceBand) {
                const priceMatch: Record<string, string[]> = {
                    whale: ["premium", "high"],
                    high: ["high", "premium"],
                    mid: ["mid", "high"],
                    low: ["low", "mid"],
                };
                if (priceMatch[fan.priceRange]?.includes(asset.priceBand)) {
                    score += 2;
                }
            }

            return {
                id: asset.id,
                ofapiMediaId: asset.ofapiMediaId,
                fileType: asset.fileType,
                title: asset.aiTitle,
                description: asset.aiDescription,
                tags,
                priceBand: asset.priceBand,
                intensity: asset.intensity,
                matchScore: score,
                matchedTags,
                alreadySent,
            };
        });

        // Sort by match score, filter out already-sent
        const suggestions = scored
            .filter((s) => !s.alreadySent && s.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10);

        const alreadySentCount = scored.filter((s) => s.alreadySent).length;

        return NextResponse.json({
            suggestions,
            totalTagged: assets.length,
            alreadySentCount,
            fanPreferences: fan.preferences.map((p) => p.tag),
        });
    } catch (e: any) {
        console.error("[Content Match] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

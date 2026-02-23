// @ts-nocheck — PENDING MIGRATION: MediaAsset.vaultTags etc
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagVaultMedia } from "@/lib/ai-vault-tagger";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/inbox/vault-tag
 *
 * Body: { creatorId, mediaAssetId }
 *
 * Downloads media from OFAPI vault, sends to Gemini for tagging,
 * stores tags on MediaAsset (vaultTags, priceBand, intensity).
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, mediaAssetId } = body;

        if (!creatorId || !mediaAssetId) {
            return NextResponse.json({ error: "Missing creatorId or mediaAssetId" }, { status: 400 });
        }

        const asset = await prisma.mediaAsset.findUnique({
            where: { id: mediaAssetId },
        });

        if (!asset) {
            return NextResponse.json({ error: "Media asset not found" }, { status: 404 });
        }

        // If already tagged, return existing tags
        if (asset.vaultTags) {
            return NextResponse.json({
                tagged: true,
                cached: true,
                tags: JSON.parse(asset.vaultTags),
                priceBand: asset.priceBand,
                intensity: asset.intensity,
            });
        }

        // For now, return a placeholder since we need the OFAPI media download
        // TODO: Integrate with OFAPI vault media download endpoint
        // The flow will be:
        // 1. Fetch media URL from OFAPI using asset.ofapiMediaId
        // 2. Download the media buffer
        // 3. Send to Gemini for tagging
        // 4. Store results

        return NextResponse.json({
            tagged: false,
            message: "Vault tagging requires media download integration — coming soon",
        });
    } catch (e: any) {
        console.error("[Vault Tag] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

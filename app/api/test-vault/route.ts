import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToVault, updateVaultMedia } from "@/lib/ofapi";
import { analyzeMediaSafety } from "@/lib/ai-analyzer";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const creator = await prisma.creator.findFirst({
            where: {
                ofapiToken: { not: null, notIn: ["unlinked"] }
            },
            orderBy: {
                updatedAt: "desc"
            }
        });

        if (!creator || !creator.ofapiToken) {
            return NextResponse.json({ success: false, error: "No connected creator found." });
        }

        const ofAccount = creator.ofapiCreatorId || creator.telegramId;
        const apiKey = process.env.OFAPI_API_KEY || "";

        // 1. Download a dummy image
        const response = await fetch("https://plus.unsplash.com/premium_photo-1661775434014-9c0e8d71de03?q=80&w=600&auto=format&fit=crop");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = "ai_vault_test.jpg";
        const mimeType = "image/jpeg";

        // 2. AI Safety Check & Tag Generation
        const aiResult = await analyzeMediaSafety(buffer, mimeType);

        if (!aiResult.isSafe) {
            return NextResponse.json({ success: false, error: "Image unsafe", aiResult });
        }

        // 3. Upload bare binary to OnlyFans Vault
        const safeTitle = (aiResult.title || "").substring(0, 50);
        const safeDescription = (aiResult.description || "").substring(0, 450);

        const uploadResponse = await uploadToVault(ofAccount, apiKey, buffer, fileName);
        const newMediaId = uploadResponse.data?.id || uploadResponse.id || uploadResponse.prefixed_id;

        if (!newMediaId) {
            return NextResponse.json({ success: false, error: "Failed to extract Media ID", data: uploadResponse });
        }

        // 4. Apply AI-generated tags to Vault Media
        const tagResponse = await updateVaultMedia(
            ofAccount,
            apiKey,
            String(newMediaId),
            safeTitle,
            safeDescription
        );

        return NextResponse.json({
            success: true,
            message: "Test Pipeline Complete",
            aiGenerated: {
                title: safeTitle,
                description: safeDescription
            },
            vaultUpload: uploadResponse,
            tagUpdate: tagResponse
        });

    } catch (e: any) {
        console.error("Test execution failed:", e);
        return NextResponse.json({ success: false, error: e.message });
    }
}

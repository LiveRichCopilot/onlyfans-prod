import { PrismaClient } from "@prisma/client";
import { uploadToVault, updateVaultMedia } from "./lib/ofapi";
import { analyzeMediaSafety } from "./lib/ai-analyzer";

const prisma = new PrismaClient();

async function runTest() {
    try {
        console.log("1. Fetching connected Creator from Database...");
        const creator = await prisma.creator.findFirst({
            where: {
                ofapiToken: { not: null, notIn: ["unlinked"] } // Find a linked account
            },
            orderBy: {
                updatedAt: "desc"
            }
        });

        if (!creator || !creator.ofapiToken) {
            console.error("No linked creators found.");
            process.exit(1);
        }

        const ofAccount = creator.ofapiCreatorId || creator.telegramId;
        console.log(`Using OF Account ID: ${ofAccount}`);

        console.log("2. Downloading a dummy image for testing...");
        const response = await fetch("https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=600&auto=format&fit=crop");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = "vault_test_photo.jpg";
        const mimeType = "image/jpeg";

        console.log("3. AI Safety Check & Tag Generation...");
        const aiResult = await analyzeMediaSafety(buffer, mimeType);

        console.log("AI Result:");
        console.log(`  Safe? ${aiResult.isSafe}`);
        console.log(`  Title: ${aiResult.title}`);
        console.log(`  Description: ${aiResult.description}`);

        if (!aiResult.isSafe) {
            console.log("Image unsafe, aborting.");
            process.exit(1);
        }

        console.log("4. Uploading bare binary to OnlyFans Vault...");
        const apiKey = process.env.OFAPI_API_KEY || "";
        const safeTitle = (aiResult.title || "").substring(0, 50);
        const safeDescription = (aiResult.description || "").substring(0, 450);

        const uploadResponse = await uploadToVault(
            ofAccount,
            apiKey,
            buffer,
            fileName
        );

        console.log("Upload Response: ", JSON.stringify(uploadResponse));

        const newMediaId = uploadResponse.data?.id || uploadResponse.id || uploadResponse.prefixed_id;

        if (!newMediaId) {
            console.error("Failed to extract Media ID from Vault upload payload!");
            process.exit(1);
        }

        console.log(`5. Applying AI-generated tags to Vault Media ID [${newMediaId}]...`);
        const tagResponse = await updateVaultMedia(
            ofAccount,
            apiKey,
            String(newMediaId),
            safeTitle,
            safeDescription
        );

        console.log("Tagging Response: ", JSON.stringify(tagResponse));
        console.log("✅ TEST PIPELINE COMPLETE. Please check your OnlyFans Vault on the website.");

    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();

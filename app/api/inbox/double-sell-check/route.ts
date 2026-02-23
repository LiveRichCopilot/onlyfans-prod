import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/inbox/double-sell-check?fanId=xxx&mediaId=xxx
 *
 * Quick check if a specific media asset was already sent to a specific fan.
 * Used before sending PPV to prevent embarrassing double-sells.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fanId = searchParams.get("fanId"); // OFAPI fan ID
    const mediaId = searchParams.get("mediaId"); // MediaAsset ID

    if (!fanId || !mediaId) {
        return NextResponse.json({ error: "Missing fanId or mediaId" }, { status: 400 });
    }

    try {
        const asset = await prisma.mediaAsset.findUnique({
            where: { id: mediaId },
        });

        if (!asset) {
            return NextResponse.json({ alreadySent: false, reason: "asset_not_found" });
        }

        const sentTo: string[] = asset.sentToFanIds ? JSON.parse(asset.sentToFanIds) : [];
        const alreadySent = sentTo.includes(fanId);

        return NextResponse.json({ alreadySent });
    } catch (e: any) {
        console.error("[Double Sell Check] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

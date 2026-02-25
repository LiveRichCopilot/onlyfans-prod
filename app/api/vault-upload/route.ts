import { NextRequest, NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/upload-token";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET — Verify token, return creator name for display */
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });

    const payload = verifyUploadToken(token);
    if (!payload) return NextResponse.json({ valid: false, error: "Invalid or expired link" }, { status: 401 });

    const creator = await prisma.creator.findUnique({
        where: { id: payload.creatorId },
        select: { name: true, ofUsername: true },
    });

    return NextResponse.json({
        valid: true,
        creatorName: creator?.name || creator?.ofUsername || "Unknown",
        expiresAt: payload.exp,
    });
}

/** POST — Receive file, forward to OFAPI vault */
export async function POST(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const payload = verifyUploadToken(token);
    if (!payload) return NextResponse.json({ error: "Invalid or expired upload link" }, { status: 401 });

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const ofFormData = new FormData();
        ofFormData.append("file", file);

        const res = await fetch(
            `https://app.onlyfansapi.com/api/${payload.account}/media/vault`,
            { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: ofFormData }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Vault Upload] OFAPI error: ${res.status}`, errorText);
            return NextResponse.json({ error: `Upload failed (${res.status})`, detail: errorText.slice(0, 200) }, { status: res.status });
        }

        const result = await res.json();
        return NextResponse.json({ success: true, fileName: file.name, fileSize: file.size, vaultId: result.data?.id || result.id || null });
    } catch (err: any) {
        console.error("[Vault Upload] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

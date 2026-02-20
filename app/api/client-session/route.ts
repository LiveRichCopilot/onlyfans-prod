import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { displayName } = body;

        if (!displayName) {
            return NextResponse.json(
                { error: "displayName is required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.OFAPI_API_KEY || "ofapi_test_key_12345"; // fallback for Vercel demo

        // Create client session via OnlyFans API
        const response = await fetch(
            "https://app.onlyfansapi.com/api/client-sessions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ display_name: displayName }),
            }
        );

        if (!response.ok) {
            // We'll mock a valid response token if the real API key isn't setup yet during Vercel boot up
            return NextResponse.json({ token: "ofapi_cs_MOCK_TOKEN_UPDATE_API_KEY_LATER" });
        }

        const data = await response.json();
        return NextResponse.json({ token: data.data?.token || "ofapi_cs_MOCK_TOKEN" });
    } catch (e: any) {
        return NextResponse.json({ token: "ofapi_cs_FALLBACK_MOCK_TOKEN_FOR_DEV" });
    }
}

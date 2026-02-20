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

        const apiKey = process.env.OFAPI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Master API Key not configured" }, { status: 500 });
        }

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
            const errStr = await response.text();
            throw new Error(`Scribe API Session creation failed: ${response.status} ${errStr}`);
        }

        const data = await response.json();
        return NextResponse.json({ token: data.data?.token || data.token });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextResponse } from "next/server";

export async function GET() {
    try {
        const token = "cb0ce7d1-e945-4235-96bd-209210e30d62";
        const payload = {
            account_ids: ["254581291"],
            start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString()
        };

        const res = await fetch("https://app.onlyfansapi.com/api/analytics/financial/transactions/by-type", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });

        const data = await res.json();
        return NextResponse.json({ success: true, keys: Object.keys(data), data: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

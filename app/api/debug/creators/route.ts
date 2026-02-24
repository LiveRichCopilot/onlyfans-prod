import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/creators — Show critical sync fields for all creators.
 * Also fetches OFAPI accounts list to show what's available for matching.
 */
export async function GET() {
    try {
        const creators = await prisma.creator.findMany({
            select: {
                id: true,
                name: true,
                ofUsername: true,
                ofapiCreatorId: true,
                ofapiToken: true,
                avatarUrl: true,
                headerUrl: true,
                telegramId: true,
                active: true,
                lastSyncCursor: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Count transactions per creator
        const txCounts = await prisma.transaction.groupBy({
            by: ["creatorId"],
            _count: true,
        });
        const txMap = new Map(txCounts.map((t) => [t.creatorId, t._count]));

        // Fetch OFAPI accounts for comparison
        let ofapiAccounts: any[] = [];
        const apiKey = process.env.OFAPI_API_KEY;
        if (apiKey) {
            try {
                const res = await fetch("https://app.onlyfansapi.com/api/accounts", {
                    headers: { Authorization: `Bearer ${apiKey}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    ofapiAccounts = (Array.isArray(data) ? data : data?.data || []).map((a: any) => ({
                        id: a.id,
                        username: a.onlyfans_username,
                        displayName: a.display_name,
                        hasAvatar: !!(a.onlyfans_user_data?.avatar),
                    }));
                }
            } catch {}
        }

        const report = creators.map((c) => ({
            id: c.id,
            name: c.name,
            ofUsername: c.ofUsername,
            ofapiCreatorId: c.ofapiCreatorId,
            tokenStatus: !c.ofapiToken ? "null" : c.ofapiToken === "unlinked" ? "unlinked" : c.ofapiToken === "linked_via_auth_module" ? "linked_via_auth_module" : "raw_key_stored",
            hasAvatar: !!c.avatarUrl,
            hasHeader: !!c.headerUrl,
            transactionCount: txMap.get(c.id) || 0,
            lastSync: c.lastSyncCursor,
            matchesOfapi: ofapiAccounts.some((a) =>
                a.id === c.ofapiCreatorId || a.username === c.ofapiCreatorId || a.username === c.ofUsername
            ),
        }));

        return NextResponse.json({
            creators: report,
            ofapiAccounts,
            summary: {
                total: report.length,
                linked: report.filter((r) => r.tokenStatus !== "unlinked" && r.tokenStatus !== "null").length,
                withAvatar: report.filter((r) => r.hasAvatar).length,
                withTransactions: report.filter((r) => r.transactionCount > 0).length,
                matchingOfapi: report.filter((r) => r.matchesOfapi).length,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

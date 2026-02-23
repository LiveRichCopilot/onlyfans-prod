import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionsSummary, getTransactions, calculateTopFans } from "@/lib/ofapi";

export const dynamic = "force-dynamic";

const OFAPI_BASE = "https://app.onlyfansapi.com";

/**
 * Auto-sync any creators missing profile data (name, avatar, header).
 * Runs inline on dashboard load — only fires when unsynced creators exist.
 */
async function autoSyncUnsynced(creators: any[]) {
    const unsynced = creators.filter(
        (c) =>
            !c.name ||
            c.name.startsWith("acct_") ||
            (!c.avatarUrl && !c.headerUrl) ||
            c.ofapiToken === "unlinked"
    );

    if (unsynced.length === 0) return;

    const apiKey = process.env.OFAPI_API_KEY;
    if (!apiKey) {
        console.error("[auto-sync] No OFAPI_API_KEY — cannot sync profiles");
        return;
    }

    try {
        const accountsRes = await fetch(`${OFAPI_BASE}/api/accounts`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!accountsRes.ok) {
            console.error("[auto-sync] OFAPI /api/accounts failed:", accountsRes.status);
            return;
        }

        const accounts = await accountsRes.json();
        const accountList = Array.isArray(accounts) ? accounts : accounts?.data || [];

        for (const creator of unsynced) {
            const match = accountList.find(
                (a: any) =>
                    a.id === creator.ofapiCreatorId ||
                    a.onlyfans_username === creator.ofapiCreatorId ||
                    a.onlyfans_username === creator.ofUsername ||
                    a.display_name === creator.ofapiCreatorId
            );

            if (!match) {
                console.log(`[auto-sync] No OFAPI match for creator ${creator.id} (${creator.ofapiCreatorId})`);
                continue;
            }

            const userData = match.onlyfans_user_data || {};
            const updateData: any = {};

            const displayName = userData.name || match.display_name;
            if (displayName) updateData.name = displayName;

            const username = match.onlyfans_username || userData.username;
            if (username) updateData.ofUsername = username;

            let avatar = userData.avatar || userData.avatarUrl;
            let header = userData.header || userData.headerUrl || userData.header_image;

            // Fallback: if accounts list didn't have avatar/header, call /api/{account}/me directly
            if (!avatar || !header) {
                try {
                    const meRes = await fetch(`${OFAPI_BASE}/api/${match.id}/me`, {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    if (meRes.ok) {
                        const me = await meRes.json();
                        if (!avatar) avatar = me.avatar || me.avatarUrl;
                        if (!header) header = me.header || me.headerUrl || me.header_image || me.headerSize?.url;
                        if (!updateData.name && me.name) updateData.name = me.name;
                        if (!updateData.ofUsername && me.username) updateData.ofUsername = me.username;
                    }
                } catch (e) {
                    console.log(`[auto-sync] /me fallback failed for ${match.id}`);
                }
            }

            if (avatar) updateData.avatarUrl = avatar;
            if (header) updateData.headerUrl = header;

            if (creator.ofapiToken === "unlinked") {
                updateData.ofapiToken = apiKey;
            }
            updateData.ofapiCreatorId = match.id;

            if (Object.keys(updateData).length > 0) {
                await prisma.creator.update({
                    where: { id: creator.id },
                    data: updateData,
                });
                console.log(`[auto-sync] Synced profile for ${updateData.name || displayName || match.id}`);
            }
        }
    } catch (e: any) {
        console.error("[auto-sync] Failed:", e.message);
    }
}

/**
 * Dashboard creators list with LIVE OFAPI revenue.
 * Will switch to Supabase once backfill is complete.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        const creators = await prisma.creator.findMany({
            orderBy: { createdAt: "desc" },
        });

        // Auto-sync moved to background — don't block page load
        // Only fire if explicitly requested via ?sync=true
        if (searchParams.get("sync") === "true") {
            autoSyncUnsynced(creators).catch(() => {}); // Fire and forget
        }

        // Compute today's revenue from DB — OnlyFans uses UK time (GMT/BST) as daily cutoff
        // Midnight UK = start of the OF "day" for statements
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
        const todayStart = new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate(), 0, 0, 0, 0);
        // Convert UK midnight back to UTC for DB query
        const ukOffset = ukNow.getTime() - now.getTime();
        const todayStartUtc = new Date(todayStart.getTime() - ukOffset);
        const hoursSinceStart = Math.max(1, (now.getTime() - todayStartUtc.getTime()) / 3600000);

        // Single query: today's transactions grouped by creator (UK day)
        const todayTx = await prisma.transaction.groupBy({
            by: ["creatorId"],
            where: { date: { gte: todayStartUtc } },
            _sum: { amount: true },
            _count: true,
        });
        const txMap = new Map(todayTx.map((t) => [t.creatorId, { sum: t._sum.amount || 0, count: t._count }]));

        // Top fan per creator (highest spend today)
        const topFanRows = await prisma.transaction.groupBy({
            by: ["creatorId", "fanId"],
            where: { date: { gte: todayStartUtc } },
            _sum: { amount: true },
            orderBy: { _sum: { amount: "desc" } },
        });
        const topFanMap = new Map<string, { fanId: string; spend: number }>();
        for (const row of topFanRows) {
            if (!topFanMap.has(row.creatorId || "")) {
                topFanMap.set(row.creatorId || "", { fanId: row.fanId, spend: row._sum.amount || 0 });
            }
        }

        // Fetch fan names for top fans
        const topFanIds = [...topFanMap.values()].map((f) => f.fanId);
        const topFans = topFanIds.length > 0
            ? await prisma.fan.findMany({ where: { id: { in: topFanIds } }, select: { id: true, name: true, username: true } })
            : [];
        const fanNameMap = new Map(topFans.map((f) => [f.id, f.username || f.name || "Fan"]));

        const enrichedCreators = creators.map((c: any) => {
            const tx = txMap.get(c.id);
            const todayRev = tx?.sum || 0;
            const txCount = tx?.count || 0;
            const hourlyRev = todayRev / hoursSinceStart;
            const topFan = topFanMap.get(c.id);

            return {
                ...c,
                name: c.name || c.ofapiCreatorId || c.telegramId || "Unknown Creator",
                handle: `@${c.ofUsername || c.ofapiCreatorId || c.telegramId}`,
                ofUsername: c.ofUsername || null,
                headerUrl: c.headerUrl || null,
                hourlyRev: Math.round(hourlyRev * 100) / 100,
                todayRev: Math.round(todayRev * 100) / 100,
                topFans: topFan ? [{ username: fanNameMap.get(topFan.fanId) || "Fan", spend: topFan.spend }] : [],
                txCount,
                target: c.hourlyTarget || 100,
                whaleAlertTarget: c.whaleAlertTarget || 200,
                lastSyncedAt: c.lastSyncCursor || null,
            };
        });

        return NextResponse.json({ creators: enrichedCreators });
    } catch (error: any) {
        console.error("Creators API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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

        const now = endParam ? new Date(endParam) : new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const todayStart = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Fetch live revenue from OFAPI for each linked creator in parallel
        const liveDataPromises = creators
            .filter((c) => c.ofapiToken && c.ofapiToken !== "unlinked")
            .map(async (creator) => {
                const accountName = creator.ofapiCreatorId || creator.telegramId;
                const apiKey = creator.ofapiToken!;

                const payloadToday = {
                    account_ids: [accountName],
                    start_date: todayStart.toISOString(),
                    end_date: now.toISOString(),
                };

                const [summaryToday, txResponse] = await Promise.all([
                    getTransactionsSummary(apiKey, payloadToday, accountName).catch(() => null),
                    getTransactions(accountName, apiKey).catch(() => null),
                ]);

                const todayRev = parseFloat(summaryToday?.data?.total_gross || summaryToday?.total_gross || "0");

                const allTx = txResponse?.data?.list || txResponse?.list || txResponse?.transactions || [];
                const todayTx = allTx.filter((t: any) => new Date(t.createdAt) >= todayStart);
                const recentTx = allTx.filter((t: any) => new Date(t.createdAt) >= oneHourAgo);
                const hourlyRev = recentTx.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
                const topFans = calculateTopFans(todayTx, 0).slice(0, 3);

                return {
                    creatorId: creator.id,
                    hourlyRev,
                    todayRev,
                    topFans,
                    txCount: todayTx.length,
                };
            });

        const liveResults = await Promise.allSettled(liveDataPromises);

        const liveMap: Record<string, any> = {};
        liveResults.forEach((r) => {
            if (r.status === "fulfilled" && r.value) {
                liveMap[r.value.creatorId] = r.value;
            }
        });

        const enrichedCreators = creators.map((c: any) => {
            const live = liveMap[c.id];
            return {
                ...c,
                name: c.name || c.ofapiCreatorId || c.telegramId || "Unknown Creator",
                handle: `@${c.ofUsername || c.ofapiCreatorId || c.telegramId}`,
                ofUsername: c.ofUsername || null,
                headerUrl: c.headerUrl || null,
                hourlyRev: live?.hourlyRev || 0,
                todayRev: live?.todayRev || 0,
                topFans: live?.topFans || [],
                txCount: live?.txCount || 0,
                target: c.hourlyTarget || 100,
                whaleAlertTarget: c.whaleAlertTarget || 200,
            };
        });

        return NextResponse.json({ creators: enrichedCreators });
    } catch (error: any) {
        console.error("Creators API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/team-analytics/content-daily?creatorId=xxx&days=7
 * Per-creator per-day content breakdown with insights.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    const days = parseInt(searchParams.get("days") || "7");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Content Daily = mass messages + wall posts + DMs (with media)
    const sourceFilter = searchParams.get("source"); // "mass_message" | "wall_post" | "direct_message" | null (all)
    const where: any = { sentAt: { gte: since } };
    if (sourceFilter) {
      where.source = sourceFilter;
    } else {
      where.source = { in: ["mass_message", "wall_post", "direct_message"] };
    }
    if (creatorId) where.creatorId = creatorId;

    // Cap results — DMs can be thousands per day
    const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 2000);

    const creatives = await prisma.outboundCreative.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: limit,
      include: {
        media: { select: { mediaType: true, fullUrl: true, previewUrl: true, thumbUrl: true, permanentUrl: true } },
        insight: { select: { tacticTag: true, hookScore: true, insight: true, viewRate: true } },
      },
    });

    // Get total count for display (without loading all records)
    const totalCount = await prisma.outboundCreative.count({ where });

    const creatorIds = [...new Set(creatives.map((c) => c.creatorId))];
    const creators = await prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, ofUsername: true },
    });
    const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));

    // ── Chatter attribution for DMs ──
    // Load shift schedules + overrides, then resolve who was on shift when each DM was sent
    const shifts = await prisma.scheduleShift.findMany({
      where: { creatorId: { in: creatorIds } },
      select: { creatorId: true, chatterEmail: true, chatterName: true, dayOfWeek: true, shiftType: true },
    });
    const overrides = await prisma.assignmentOverride.findMany({
      where: { creatorId: { in: creatorIds }, startAt: { lte: new Date() }, endAt: { gte: since } },
      select: { creatorId: true, chatterEmail: true, startAt: true, endAt: true },
    });
    function resolveChatter(cId: string, sentAt: Date): string | null {
      // Override takes priority
      for (const o of overrides) {
        if (o.creatorId === cId && sentAt >= o.startAt && sentAt <= o.endAt) return o.chatterEmail;
      }
      // Convert to UK time to determine shift
      const ukDate = new Date(sentAt.toLocaleString("en-US", { timeZone: "Europe/London" }));
      const ukHour = ukDate.getHours();
      let dayOfWeek = ukDate.getDay(); // 0=Sun
      let shiftType: string;
      if (ukHour >= 7 && ukHour < 15) shiftType = "morning";
      else if (ukHour >= 15 && ukHour < 23) shiftType = "afternoon";
      else {
        shiftType = "night";
        if (ukHour < 7) dayOfWeek = (dayOfWeek + 6) % 7; // night shift started previous day
      }
      const match = shifts.find((s) => s.creatorId === cId && s.dayOfWeek === dayOfWeek && s.shiftType === shiftType);
      return match?.chatterName || match?.chatterEmail || null;
    }

    // Group by date (UK timezone)
    const dailyMap = new Map<string, {
      date: string; massMessages: number; dms: number; wallPosts: number; withMedia: number; bumps: number;
      totalSent: number; totalViewed: number; free: number; paid: number;
    }>();

    for (const c of creatives) {
      const dateKey = new Date(c.sentAt).toLocaleDateString("en-GB", {
        timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
      });
      const iso = dateKey.split("/").reverse().join("-");
      const d = dailyMap.get(iso) || {
        date: iso, massMessages: 0, dms: 0, wallPosts: 0, withMedia: 0, bumps: 0,
        totalSent: 0, totalViewed: 0, free: 0, paid: 0,
      };
      if (c.source === "mass_message") d.massMessages++;
      else if (c.source === "direct_message") d.dms++;
      else if (c.source === "wall_post") d.wallPosts++;
      if (c.mediaCount > 0) d.withMedia++; else d.bumps++;
      d.totalSent += c.sentCount;
      d.totalViewed += c.viewedCount;
      if (c.isFree) d.free++; else d.paid++;
      dailyMap.set(iso, d);
    }

    const daily = [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date));

    // ── Hourly breakdown (UK timezone) — "1 hour, 2 hours, someone hasn't sent..." ──
    type HourSlot = { hour: number; count: number; sources: Record<string, number>; creators: string[] };
    const hourlyMap = new Map<string, Map<number, HourSlot>>();
    for (const c of creatives) {
      const ukDate = new Date(new Date(c.sentAt).toLocaleString("en-US", { timeZone: "Europe/London" }));
      const dateKey = `${ukDate.getFullYear()}-${String(ukDate.getMonth() + 1).padStart(2, "0")}-${String(ukDate.getDate()).padStart(2, "0")}`;
      const hour = ukDate.getHours();
      if (!hourlyMap.has(dateKey)) hourlyMap.set(dateKey, new Map());
      const dayHours = hourlyMap.get(dateKey)!;
      const slot = dayHours.get(hour) || { hour, count: 0, sources: {}, creators: [] };
      slot.count++;
      slot.sources[c.source] = (slot.sources[c.source] || 0) + 1;
      const cName = creatorMap[c.creatorId]?.name || "Unknown";
      if (!slot.creators.includes(cName)) slot.creators.push(cName);
      dayHours.set(hour, slot);
    }
    const hourly = [...hourlyMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, hours]) => ({
        date,
        hours: Array.from({ length: 24 }, (_, h) => hours.get(h) || { hour: h, count: 0, sources: {}, creators: [] }),
      }));

    // ── Real-time purchase counts from transactions (source of truth) ──
    // Check transactions for PPVs that either:
    //   1. Never enriched (purchasedCount is null)
    //   2. Enriched as 0 but still in buying window (sale may have come in after enrichment)
    const now = new Date();
    const ppvsNeedingLiveCount = creatives.filter((c) => {
      if (c.isFree || !c.priceCents || c.priceCents <= 0) return false;
      if (c.purchasedCount == null) return true; // Never enriched
      if (c.purchasedCount === 0) {
        // Already enriched as 0 — re-check if still within 48h window
        const age = now.getTime() - new Date(c.sentAt).getTime();
        return age < 48 * 3600_000;
      }
      return false;
    }).slice(0, 50); // Cap at 50 to prevent API timeout — each does 2-3 DB queries
    const livePurchaseCounts = new Map<string, number>();
    if (ppvsNeedingLiveCount.length > 0) {
      for (const ppv of ppvsNeedingLiveCount) {
        try {
          const sentAt = new Date(ppv.sentAt);
          const maxWindow = new Date(Math.min(sentAt.getTime() + 48 * 3600_000, now.getTime()));

          if (ppv.source === "direct_message") {
            // DM: exact fan-level match using raw.toUser.id (OFAPI stores fan as toUser object)
            const rawObj = ppv.raw as Record<string, any> | null;
            const toUserId = rawObj?.toUser?.id ? String(rawObj.toUser.id) : (rawObj?.toUserId ? String(rawObj.toUserId) : null);
            if (toUserId) {
              let fan = await prisma.fan.findFirst({ where: { ofapiFanId: toUserId }, select: { id: true } });
              if (!fan) {
                try { fan = await prisma.fan.create({ data: { ofapiFanId: toUserId, creatorId: ppv.creatorId, lifetimeSpend: 0 }, select: { id: true } }); } catch { fan = await prisma.fan.findFirst({ where: { ofapiFanId: toUserId }, select: { id: true } }); }
              }
              if (fan) {
                const priceDollars = ppv.priceCents! / 100;
                const count = await prisma.transaction.count({
                  where: {
                    creatorId: ppv.creatorId, fanId: fan.id,
                    type: { contains: "message" }, amount: { gte: priceDollars - 0.02, lte: priceDollars + 0.02 },
                    date: { gt: sentAt, lte: maxWindow },
                  },
                });
                if (count > 0) livePurchaseCounts.set(ppv.id, 1);
              }
            }
          } else {
            // Mass message / wall post: aggregate count
            const count = await prisma.transaction.count({
              where: {
                creatorId: ppv.creatorId, type: { contains: "message" },
                amount: { gt: 0 }, date: { gt: sentAt, lte: maxWindow },
              },
            });
            if (count > 0) livePurchaseCounts.set(ppv.id, count);
          }
        } catch { /* skip */ }
      }
    }

    // ── Fan lookup for DMs — batch load fan data for all DM recipients ──
    type FanInfo = { username: string | null; name: string | null; label: string | null; lifetimeSpend: number };
    const fanDataMap = new Map<string, FanInfo>();
    const fanIds = new Set<string>();
    for (const c of creatives) {
      if (c.source !== "direct_message") continue;
      const r = c.raw as Record<string, any> | null;
      const id = r?.toUser?.id ? String(r.toUser.id) : r?.toUserId ? String(r.toUserId) : null;
      if (id) fanIds.add(id);
    }
    if (fanIds.size > 0) {
      const fans = await prisma.fan.findMany({
        where: { ofapiFanId: { in: [...fanIds] } },
        select: { ofapiFanId: true, username: true, name: true, lifetimeSpend: true, priceRange: true, buyerType: true, stage: true },
      });
      for (const f of fans) {
        const label = f.lifetimeSpend >= 5000 ? "SVIP" : f.lifetimeSpend >= 2000 ? "Diamond" : f.lifetimeSpend >= 500 ? "VIP"
          : f.priceRange === "whale" ? "Whale" : f.stage === "at_risk" ? "At Risk" : null;
        fanDataMap.set(f.ofapiFanId, { username: f.username, name: f.name, label, lifetimeSpend: f.lifetimeSpend });
      }
      // Fill in from raw OFAPI data for fans not yet in DB
      for (const c of creatives) {
        if (c.source !== "direct_message") continue;
        const r = c.raw as Record<string, any> | null;
        const id = r?.toUser?.id ? String(r.toUser.id) : r?.toUserId ? String(r.toUserId) : null;
        if (id && !fanDataMap.has(id) && r?.toUser)
          fanDataMap.set(id, { username: r.toUser.username || null, name: r.toUser.name || null, label: null, lifetimeSpend: 0 });
      }
    }

    // ── VALIDATION: Only include items with actual media ──
    // Text-only messages (mediaCount=0) were showing as blank cards.
    // Filter them out server-side so no blank image placeholder ever renders.
    const withMedia = creatives.filter((c) => c.mediaCount > 0 && c.media.length > 0);

    const items = withMedia.map((c) => {
      const sentAtUk = new Date(c.sentAt).toLocaleString("en-GB", { timeZone: "Europe/London" });
      const viewRate = c.sentCount > 0 ? Math.round((c.viewedCount / c.sentCount) * 1000) / 10 : 0;
      const hoursLive = Math.round((Date.now() - new Date(c.sentAt).getTime()) / 3600000);
      const isPaid = !c.isFree && c.priceCents && c.priceCents > 0;
      // Determine purchased count from best available source:
      // 1. Live transaction match (real-time)
      // 2. OFAPI canPurchase flag (authoritative for DMs)
      // 3. Enrichment count (from buyers-enrichment cron)
      const liveCount = livePurchaseCounts.get(c.id);
      const rawObj = c.raw as Record<string, any> | null;
      const ofapiSold = c.source === "direct_message" && rawObj?.canPurchase === false;
      let purchased: number | null;
      if (liveCount != null && liveCount > 0) {
        purchased = Math.max(c.purchasedCount ?? 0, liveCount);
      } else if (ofapiSold) {
        purchased = Math.max(c.purchasedCount ?? 0, 1);
      } else {
        purchased = c.purchasedCount; // null = unknown, 0 = no purchases
      }
      let status: "selling" | "stagnant" | "awaiting" | "free" | "unsent" = "free";
      if (c.isCanceled) status = "unsent";
      else if (isPaid && purchased != null && purchased > 0) status = "selling";
      else if (isPaid && purchased != null && purchased === 0 && hoursLive >= 6) status = "stagnant";
      else if (isPaid && purchased == null) status = "awaiting"; // no buyer data yet
      else if (isPaid) status = "awaiting"; // paid, < 6h, give it time
      return {
        id: c.id, externalId: c.externalId,
        creator: creatorMap[c.creatorId] || { name: "Unknown", ofUsername: "" },
        sentAt: c.sentAt, sentAtUk, hoursLive,
        caption: c.textPlain || c.textHtml || "",
        isFree: c.isFree, priceCents: c.priceCents, mediaCount: c.mediaCount,
        sentCount: c.sentCount, viewedCount: c.viewedCount, viewRate,
        purchasedCount: purchased,
        // Wake-up data only valid for mass messages + wall posts, not DMs
        totalReplied: c.source !== "direct_message" ? c.totalReplied : null,
        dormantBefore: c.source !== "direct_message" ? c.dormantBefore : null,
        baselineReplied: c.source !== "direct_message" ? (c as any).baselineReplied : null,
        wakeUp1h: c.source !== "direct_message" ? c.wakeUp1h : null,
        wakeUp3h: c.source !== "direct_message" ? c.wakeUp3h : null,
        wakeUp6h: c.source !== "direct_message" ? c.wakeUp6h : null,
        wakeUp24h: c.source !== "direct_message" ? c.wakeUp24h : null,
        reactivationBuckets: c.source !== "direct_message" ? c.reactivationBuckets as Record<string, number> | null : null,
        isCanceled: c.isCanceled, status,
        source: c.source, // "mass_message" | "wall_post" | "direct_message"
        type: (c.mediaCount > 0 ? "content" : "bump") as "content" | "bump",
        chatterName: c.source === "direct_message" ? resolveChatter(c.creatorId, new Date(c.sentAt)) : null,
        media: c.media, insight: c.insight,
        ...(() => { // Fan data for DMs
          if (c.source !== "direct_message") return {};
          const r = c.raw as Record<string, any> | null;
          const tid = r?.toUser?.id ? String(r.toUser.id) : r?.toUserId ? String(r.toUserId) : null;
          const f = tid ? fanDataMap.get(tid) : null;
          return { fanUsername: f?.username || r?.toUser?.username || null, fanName: f?.name || r?.toUser?.name || null, fanLabel: f?.label || null, fanSpend: f?.lifetimeSpend ?? null };
        })(),
      };
    }).filter((item) => {
      // Final validation: every item MUST have at least one media record with a displayable URL
      const hasDisplayableMedia = item.media.some(
        (m: any) => m.permanentUrl || m.previewUrl || m.thumbUrl || m.fullUrl
      );
      if (!hasDisplayableMedia) {
        console.warn(`[content-daily] Filtered out item ${item.id} (${item.creator.name}) — no displayable media URL`);
      }
      return hasDisplayableMedia;
    });

    // ── Bumps: text-only messages (no media) — returned separately ──
    const textOnly = creatives.filter((c) => c.mediaCount === 0 || c.media.length === 0);
    const bumps = textOnly.map((c) => {
      const sentAtUk = new Date(c.sentAt).toLocaleString("en-GB", { timeZone: "Europe/London" });
      const viewRate = c.sentCount > 0 ? Math.round((c.viewedCount / c.sentCount) * 1000) / 10 : 0;
      return {
        id: c.id,
        creator: creatorMap[c.creatorId] || { name: "Unknown", ofUsername: "" },
        sentAtUk,
        caption: c.textPlain || c.textHtml || "",
        sentCount: c.sentCount,
        viewedCount: c.viewedCount,
        viewRate,
        source: c.source,
        chatterName: c.source === "direct_message" ? resolveChatter(c.creatorId, new Date(c.sentAt)) : null,
      };
    });

    // ── Chatter DM Sales Stats ──
    // Group DM PPVs by chatter → sold vs not sold
    const chatterDmStats: { chatter: string; sent: number; sold: number; unsold: number; pending: number; revenue: number; creators: string[] }[] = [];
    const dmPpvItems = items.filter((i) => i.source === "direct_message" && !i.isFree && i.priceCents && i.priceCents > 0);
    const chatterDmMap = new Map<string, { sent: number; sold: number; unsold: number; pending: number; revenue: number; creators: Set<string> }>();
    for (const dm of dmPpvItems) {
      const chatter = dm.chatterName || "Unassigned";
      const e = chatterDmMap.get(chatter) || { sent: 0, sold: 0, unsold: 0, pending: 0, revenue: 0, creators: new Set<string>() };
      e.sent++;
      if (dm.purchasedCount != null && dm.purchasedCount > 0) {
        e.sold++;
        e.revenue += (dm.priceCents || 0) / 100;
      } else if (dm.status === "stagnant") {
        e.unsold++;
      } else {
        e.pending++;
      }
      e.creators.add(dm.creator.name || "Unknown");
      chatterDmMap.set(chatter, e);
    }
    for (const [chatter, stats] of chatterDmMap) {
      chatterDmStats.push({ chatter, ...stats, creators: [...stats.creators] });
    }
    chatterDmStats.sort((a, b) => b.sold - a.sold || b.sent - a.sent);

    const totalMessages = creatives.length;
    const totalWithMedia = creatives.filter((c) => c.mediaCount > 0).length;
    const totalSent = creatives.reduce((s, c) => s + c.sentCount, 0);
    const totalViewed = creatives.reduce((s, c) => s + c.viewedCount, 0);
    const avgViewRate = totalSent > 0 ? Math.round((totalViewed / totalSent) * 1000) / 10 : 0;
    const insightsCount = creatives.filter((c) => c.insight).length;

    const tacticCounts = new Map<string, { count: number; totalScore: number }>();
    for (const c of creatives) {
      if (!c.insight) continue;
      const tag = c.insight.tacticTag;
      const e = tacticCounts.get(tag) || { count: 0, totalScore: 0 };
      e.count++;
      e.totalScore += c.insight.hookScore;
      tacticCounts.set(tag, e);
    }
    const tactics = [...tacticCounts.entries()]
      .map(([tag, d]) => ({ tag, count: d.count, avgScore: Math.round(d.totalScore / d.count) }))
      .sort((a, b) => b.count - a.count);

    // Silent models — active creators with no content in this window
    const allCreators = await prisma.creator.findMany({ where: { active: true }, select: { id: true, name: true, ofUsername: true } });
    const anyActivity = await prisma.outboundCreative.groupBy({ by: ["creatorId"], where: { sentAt: { gte: since }, mediaCount: { gt: 0 } } });
    const activeCreatorIds = new Set(anyActivity.map((a) => a.creatorId));
    const silentModels = await Promise.all(
      allCreators.filter((c) => !activeCreatorIds.has(c.id)).map(async (c) => {
        const last = await prisma.outboundCreative.findFirst({ where: { creatorId: c.id, mediaCount: { gt: 0 } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
        const age = last ? Date.now() - new Date(last.sentAt).getTime() : null;
        return { id: c.id, name: c.name || c.ofUsername || "Unknown", ofUsername: c.ofUsername, lastContentAt: last?.sentAt || null, hoursSilent: age ? Math.round(age / 3600000) : null, daysSilent: age ? Math.round(age / 86400000) : null };
      })
    );

    // Model leaderboard — who sent the most
    const modelCounts = new Map<string, { name: string; ofUsername: string; massMessages: number; withMedia: number; bumps: number; totalSent: number; totalViewed: number; purchased: number }>();
    for (const c of creatives) {
      const key = c.creatorId;
      const cr = creatorMap[key] || { name: "Unknown", ofUsername: "" };
      const e = modelCounts.get(key) || { name: cr.name || "Unknown", ofUsername: cr.ofUsername || "", massMessages: 0, withMedia: 0, bumps: 0, totalSent: 0, totalViewed: 0, purchased: 0 };
      e.massMessages++;
      if (c.mediaCount > 0) e.withMedia++; else e.bumps++;
      e.totalSent += c.sentCount;
      e.totalViewed += c.viewedCount;
      const liveC = livePurchaseCounts.get(c.id);
      const pCount = liveC != null ? Math.max(c.purchasedCount ?? 0, liveC) : (c.purchasedCount ?? 0);
      if (pCount > 0) e.purchased += pCount;
      modelCounts.set(key, e);
    }
    const leaderboard = [...modelCounts.values()].sort((a, b) => b.massMessages - a.massMessages);

    return NextResponse.json({
      kpis: { totalMessages, totalWithMedia, totalSent, totalViewed, avgViewRate, insightsCount },
      daily, hourly, items, bumps, tactics, silentModels, leaderboard, chatterDmStats, totalCount,
      dateRange: { days, since: since.toISOString() },
    });
  } catch (err: any) {
    console.error("[content-daily]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

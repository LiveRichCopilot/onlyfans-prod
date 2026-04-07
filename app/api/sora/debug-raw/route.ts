import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSoraAuthSafe, canAccessModel } from "@/lib/sora-access";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OFAPI_BASE = "https://app.onlyfansapi.com";

/**
 * GET /api/sora/debug-raw?modelId=xxx&days=14
 *
 * One-shot diagnostic endpoint. For a given model, returns side-by-side:
 *   1. Our OutboundCreative rows (what the Sora UI currently reads)
 *   2. Matching MassMessageStat rows (what the sync-mass-message-stats cron writes)
 *   3. A live OFAPI pull for the same window (source of truth)
 *
 * This lets us see exactly which field mismatches and where.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getSoraAuthSafe();
    if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") || "14", 10)));
    if (!modelId) return NextResponse.json({ error: "modelId required" }, { status: 400 });

    const allowed = await canAccessModel(ctx, modelId);
    if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const model = await prisma.creator.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        name: true,
        ofUsername: true,
        ofapiCreatorId: true,
        ofapiToken: true,
      },
    });
    if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    // 1. OutboundCreative (current source)
    const ocRows = await prisma.outboundCreative.findMany({
      where: {
        creatorId: modelId,
        source: "mass_message",
        sentAt: { gte: startDate, lte: endDate },
        isCanceled: false,
      },
      select: {
        id: true,
        externalId: true,
        sentAt: true,
        priceCents: true,
        sentCount: true,
        viewedCount: true,
        purchasedCount: true,
        isFree: true,
        textPlain: true,
        raw: true,
      },
      orderBy: { sentAt: "desc" },
    });

    // 2. MassMessageStat (alternate table)
    const mmsRows = await prisma.massMessageStat.findMany({
      where: { creatorId: modelId, sentAt: { gte: startDate, lte: endDate } },
      select: {
        messageId: true,
        sentAt: true,
        priceCents: true,
        sentCount: true,
        viewedCount: true,
        purchasedCount: true,
        text: true,
        raw: true,
      },
      orderBy: { sentAt: "desc" },
    });

    // 3. Live OFAPI pull
    let liveOfapi: any[] = [];
    let ofapiError: string | null = null;
    try {
      const apiKey = (process.env.OFAPI_API_KEY || "").trim();
      const acctId = model.ofapiCreatorId;
      if (!apiKey) throw new Error("Missing OFAPI_API_KEY");
      if (!acctId) throw new Error("Model has no ofapiCreatorId");
      const s = encodeURIComponent(startDate.toISOString().replace("T", " ").replace(/\.\d+Z$/, ""));
      const e = encodeURIComponent(endDate.toISOString().replace("T", " ").replace(/\.\d+Z$/, ""));
      const url = `${OFAPI_BASE}/api/${acctId}/engagement/messages/mass-messages?startDate=${s}&endDate=${e}&limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        ofapiError = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      } else {
        const json = await res.json();
        liveOfapi = json?.data?.items ?? [];
      }
    } catch (e: any) {
      ofapiError = e.message;
    }

    // Build a side-by-side comparison keyed by OFAPI message ID
    const byId = new Map<string, any>();
    for (const r of ocRows) {
      byId.set(r.externalId, {
        externalId: r.externalId,
        sentAt: r.sentAt.toISOString(),
        textPreview: (r.textPlain || "").slice(0, 80),
        outboundCreative: {
          priceCents: r.priceCents,
          sentCount: r.sentCount,
          viewedCount: r.viewedCount,
          purchasedCount: r.purchasedCount,
          isFree: r.isFree,
        },
      });
    }
    for (const r of mmsRows) {
      const id = r.messageId.toString();
      const existing = byId.get(id) || {
        externalId: id,
        sentAt: r.sentAt.toISOString(),
        textPreview: (r.text || "").slice(0, 80),
      };
      existing.massMessageStat = {
        priceCents: r.priceCents,
        sentCount: r.sentCount,
        viewedCount: r.viewedCount,
        purchasedCount: r.purchasedCount,
      };
      byId.set(id, existing);
    }
    for (const m of liveOfapi) {
      const id = String(m.id || "");
      if (!id) continue;
      const existing = byId.get(id) || {
        externalId: id,
        sentAt: m.date || null,
        textPreview: (m.rawText || m.text || "").slice(0, 80),
      };
      existing.liveOfapi = {
        price: m.price,
        sentCount: m.sentCount,
        viewedCount: m.viewedCount,
        purchasedCount: m.purchasedCount,
        isFree: m.isFree,
        allKeys: Object.keys(m),
      };
      byId.set(id, existing);
    }

    const comparison = [...byId.values()]
      .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
      .slice(0, 10);

    // Totals across all three sources
    const totals = {
      outboundCreative: {
        rows: ocRows.length,
        totalPurchases: ocRows.reduce(
          (s: number, r: typeof ocRows[number]) => s + (r.purchasedCount || 0),
          0,
        ),
        totalSends: ocRows.reduce(
          (s: number, r: typeof ocRows[number]) => s + (r.sentCount || 0),
          0,
        ),
        totalEarnedCents: ocRows.reduce(
          (s: number, r: typeof ocRows[number]) => s + (r.purchasedCount || 0) * (r.priceCents || 0),
          0,
        ),
      },
      massMessageStat: {
        rows: mmsRows.length,
        totalPurchases: mmsRows.reduce(
          (s: number, r: typeof mmsRows[number]) => s + (r.purchasedCount || 0),
          0,
        ),
        totalSends: mmsRows.reduce(
          (s: number, r: typeof mmsRows[number]) => s + (r.sentCount || 0),
          0,
        ),
        totalEarnedCents: mmsRows.reduce(
          (s: number, r: typeof mmsRows[number]) => s + (r.purchasedCount || 0) * (r.priceCents || 0),
          0,
        ),
      },
      liveOfapi: {
        rows: liveOfapi.length,
        totalPurchases: liveOfapi.reduce((s: number, m: any) => s + (Number(m.purchasedCount) || 0), 0),
        totalSends: liveOfapi.reduce((s: number, m: any) => s + (Number(m.sentCount) || 0), 0),
        totalEarnedDollars: liveOfapi.reduce((s: number, m: any) => {
          const p = typeof m.price === "string" ? parseFloat(m.price) : Number(m.price) || 0;
          return s + p * (Number(m.purchasedCount) || 0);
        }, 0),
      },
    };

    // Capture the raw JSON of ONE row from each source so we can see every field
    const sampleRawOC = ocRows.find((r: typeof ocRows[number]) => (r.purchasedCount || 0) > 0)?.raw || null;
    const sampleRawMMS = mmsRows.find((r: typeof mmsRows[number]) => (r.purchasedCount || 0) > 0)?.raw || null;
    const sampleLive = liveOfapi.find((m: any) => (Number(m.purchasedCount) || 0) > 0) || liveOfapi[0] || null;

    return NextResponse.json({
      model: { id: model.id, name: model.name, ofUsername: model.ofUsername, ofapiCreatorId: model.ofapiCreatorId },
      windowDays: days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totals,
      ofapiError,
      comparison,
      samples: {
        outboundCreativeRaw: sampleRawOC,
        massMessageStatRaw: sampleRawMMS,
        liveOfapiRaw: sampleLive,
      },
    });
  } catch (err: any) {
    console.error("[sora/debug-raw]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

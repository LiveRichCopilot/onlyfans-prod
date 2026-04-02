import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for large backfills

const OFAPI_BASE = "https://app.onlyfansapi.com";

async function ofapiFetch(path: string, apiKey: string) {
  const url = path.startsWith("http") ? path : `${OFAPI_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OFAPI ${res.status}: ${path.slice(0, 80)}`);
  return res.json();
}

async function fetchAllPages(path: string, apiKey: string, maxPages = 40) {
  const all: any[] = [];
  let p: string | undefined = path;
  let pages = 0;
  while (p && pages < maxPages) {
    const raw = await ofapiFetch(p, apiKey);
    const items = raw?.data?.items ?? [];
    all.push(...items);
    pages++;
    p = raw?.data?.hasMore && raw?._pagination?.next_page ? raw._pagination.next_page : undefined;
  }
  return all;
}

function fmtDate(d: Date) { return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, ""); }

/**
 * POST /api/backfill/mass-messages
 * Body: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 * Pulls mass messages from OFAPI for ALL authenticated accounts in the date range.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) return NextResponse.json({ error: "No OFAPI_API_KEY" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const startDate = body.startDate ? new Date(body.startDate) : new Date(Date.now() - 17 * 86400000);
    const endDate = body.endDate ? new Date(body.endDate) : new Date();

    // Get all active creators with OFAPI tokens
    const creators = await prisma.creator.findMany({
      where: { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } },
      select: { id: true, name: true, ofapiCreatorId: true },
    });

    const s = encodeURIComponent(fmtDate(startDate));
    const e = encodeURIComponent(fmtDate(endDate));
    const results: { name: string; upserted: number; mediaCreated: number; error?: string }[] = [];

    for (const creator of creators) {
      try {
        const acctId = creator.ofapiCreatorId!;
        const messages = await fetchAllPages(
          `/api/${acctId}/engagement/messages/mass-messages?startDate=${s}&endDate=${e}&limit=50`, apiKey
        );

        let upserted = 0;
        let mediaCreated = 0;
        for (const m of messages) {
          const externalId = String(m.id || "");
          if (!externalId) continue;

          let priceCents: number | null = null;
          if (m.price != null) {
            const p = typeof m.price === "string" ? parseFloat(m.price) : Number(m.price);
            if (!isNaN(p) && p > 0) priceCents = Math.round(p * 100);
          }
          let purchasedCount: number | null = null;
          if (m.purchasedCount != null) {
            const pc = typeof m.purchasedCount === "string" ? parseInt(m.purchasedCount) : Number(m.purchasedCount);
            if (!isNaN(pc)) purchasedCount = pc;
          }

          const row = await prisma.outboundCreative.upsert({
            where: { creatorId_source_externalId: { creatorId: creator.id, source: "mass_message", externalId } },
            create: {
              creatorId: creator.id, externalId, source: "mass_message",
              sentAt: m.date ? new Date(m.date) : endDate,
              textHtml: m.text ?? null, textPlain: m.rawText ?? m.text ?? null,
              isFree: m.isFree !== false, priceCents, purchasedCount,
              mediaCount: m.mediaCount ?? 0, sentCount: m.sentCount ?? 0, viewedCount: m.viewedCount ?? 0,
              isCanceled: m.isCanceled === true, canUnsend: m.canUnsend === true, raw: m,
            },
            update: {
              sentAt: m.date ? new Date(m.date) : endDate,
              priceCents, purchasedCount, mediaCount: m.mediaCount ?? 0,
              sentCount: m.sentCount ?? 0, viewedCount: m.viewedCount ?? 0,
              isCanceled: m.isCanceled === true, raw: m,
            },
          });
          upserted++;

          // Create media records (without persistence — CDN URLs may be expired for old messages)
          if (Array.isArray(m.media) && m.media.length > 0) {
            const existingCount = await prisma.outboundMedia.count({ where: { creativeId: row.id } });
            if (existingCount === 0) {
              for (const mi of m.media) {
                if (!mi?.files || (!mi.files?.full?.url && !mi.files?.preview?.url && !mi.files?.thumb?.url)) continue;
                await prisma.outboundMedia.create({
                  data: {
                    creativeId: row.id,
                    onlyfansMediaId: mi.id ? String(mi.id) : null,
                    mediaType: mi.type || "photo",
                    fullUrl: mi.files?.full?.url ?? null,
                    previewUrl: mi.files?.preview?.url ?? null,
                    thumbUrl: mi.files?.thumb?.url ?? null,
                    persistStatus: "pending",
                  },
                });
                mediaCreated++;
              }
            }
          }
        }
        results.push({ name: creator.name || "Unknown", upserted, mediaCreated });
      } catch (err: any) {
        results.push({ name: creator.name || "Unknown", upserted: 0, mediaCreated: 0, error: err.message });
      }
    }

    const totalUpserted = results.reduce((s, r) => s + r.upserted, 0);
    const totalMedia = results.reduce((s, r) => s + r.mediaCreated, 0);
    const errors = results.filter((r) => r.error);

    return NextResponse.json({
      success: true,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      creators: results.length,
      totalUpserted,
      totalMedia,
      errors: errors.length,
      details: results,
    });
  } catch (err: any) {
    console.error("[backfill/mass-messages]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

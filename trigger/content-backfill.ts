/**
 * Content Backfill Task
 *
 * Pulls mass messages for all creators over a configurable window.
 * Runs in Trigger.dev (no timeout). Upserts to OutboundCreative + OutboundMedia.
 */
import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const OFAPI_BASE = "https://app.onlyfansapi.com";

export const contentBackfill = task({
  id: "content-backfill",
  retry: { maxAttempts: 1 },
  run: async (payload: { days?: number; creatorId?: string }) => {
    const apiKey = (process.env.OFAPI_API_KEY || "").trim();
    if (!apiKey) throw new Error("OFAPI_API_KEY not set");

    const days = payload.days || 7;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const where: any = { active: true, ofapiToken: { not: null }, ofapiCreatorId: { not: null } };
    if (payload.creatorId) where.id = payload.creatorId;

    const creators = await prisma.creator.findMany({
      where,
      select: { id: true, ofapiCreatorId: true, name: true },
    });

    let totalUpserted = 0;
    let totalMedia = 0;
    const results: any[] = [];

    for (const creator of creators) {
      const acctId = creator.ofapiCreatorId!;
      let upserted = 0;
      let media = 0;

      try {
        // Fetch all pages of mass messages
        const s = encodeURIComponent(formatDate(startDate));
        const e = encodeURIComponent(formatDate(now));
        let path: string | undefined = `${OFAPI_BASE}/api/${acctId}/engagement/messages/mass-messages?startDate=${s}&endDate=${e}&limit=50`;
        let pages = 0;

        while (path && pages < 20) {
          const res: Response = await fetch(path, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) break;

          const raw = await res.json();
          const items = raw?.data?.items ?? [];
          const nextPage = raw?._pagination?.next_page;

          for (const m of items) {
            const externalId = String(m.id || "");
            if (!externalId) continue;

            let priceCents: number | null = null;
            if (m.price != null) {
              const p = typeof m.price === "string" ? parseFloat(m.price) : Number(m.price);
              if (!isNaN(p) && p > 0) priceCents = Math.round(p * 100);
            }

            const shared = {
              sentAt: m.date ? new Date(m.date) : now,
              textHtml: m.text ?? null,
              textPlain: m.rawText ?? m.text ?? null,
              isFree: m.isFree !== false,
              priceCents,
              mediaCount: m.mediaCount ?? 0,
              sentCount: m.sentCount ?? 0,
              viewedCount: m.viewedCount ?? 0,
              isCanceled: m.isCanceled === true,
              canUnsend: m.canUnsend === true,
              raw: m,
            };

            const row = await prisma.outboundCreative.upsert({
              where: {
                creatorId_source_externalId: {
                  creatorId: creator.id,
                  source: "mass_message",
                  externalId,
                },
              },
              create: { creatorId: creator.id, externalId, source: "mass_message", ...shared },
              update: shared,
            });
            upserted++;

            // Sync media
            if (Array.isArray(m.media) && m.media.length > 0) {
              await prisma.outboundMedia.deleteMany({ where: { creativeId: row.id } });
              for (const med of m.media) {
                const f = med?.files;
                if (!f) continue;
                const fullUrl = f?.full?.url ?? null;
                const previewUrl = f?.preview?.url ?? null;
                const thumbUrl = f?.thumb?.url ?? null;
                if (!fullUrl && !previewUrl && !thumbUrl) continue;
                await prisma.outboundMedia.create({
                  data: {
                    creativeId: row.id,
                    mediaType: med.type || "photo",
                    fullUrl, previewUrl, thumbUrl,
                    duration: med.duration ?? null,
                    width: med.width ?? null,
                    height: med.height ?? null,
                  },
                });
                media++;
              }
            }
          }

          pages++;
          path = nextPage || undefined;
          // Rate limit
          await new Promise((r) => setTimeout(r, 200));
        }

        results.push({ creator: creator.name, upserted, media, pages });
        totalUpserted += upserted;
        totalMedia += media;
      } catch (err: any) {
        results.push({ creator: creator.name, error: err.message });
      }
    }

    // Phase 2: Wall posts via GET /api/{account}/posts
    let totalPosts = 0;
    for (const creator of creators) {
      const acctId = creator.ofapiCreatorId!;
      try {
        let postPath: string | undefined = `${OFAPI_BASE}/api/${acctId}/posts?limit=50`;
        let postPages = 0;
        while (postPath && postPages < 10) {
          const res: Response = await fetch(postPath, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) break;
          const raw = await res.json();
          const posts = raw?.data?.list ?? raw?.data ?? [];
          const nextPage = raw?._pagination?.next_page;

          for (const p of posts) {
            const postId = String(p.id || "");
            if (!postId) continue;
            const postDate = p.postedAt || p.createdAt || p.date;
            if (postDate && new Date(postDate) < startDate) continue; // outside window

            const shared = {
              sentAt: postDate ? new Date(postDate) : now,
              textHtml: p.text ?? null,
              textPlain: p.rawText ?? p.text ?? null,
              isFree: p.price == null || p.price === 0,
              priceCents: p.price ? Math.round(Number(p.price) * 100) : null,
              mediaCount: p.mediaCount ?? (Array.isArray(p.media) ? p.media.length : 0),
              sentCount: p.tipsCount ?? 0,
              viewedCount: p.likesCount ?? 0,
              isCanceled: false,
              canUnsend: false,
              raw: p,
            };

            const row = await prisma.outboundCreative.upsert({
              where: {
                creatorId_source_externalId: { creatorId: creator.id, source: "wall_post", externalId: postId },
              },
              create: { creatorId: creator.id, externalId: postId, source: "wall_post", ...shared },
              update: shared,
            });
            totalPosts++;

            // Sync post media
            if (Array.isArray(p.media) && p.media.length > 0) {
              await prisma.outboundMedia.deleteMany({ where: { creativeId: row.id } });
              for (const med of p.media) {
                const f = med?.files || med;
                const fullUrl = f?.full?.url ?? f?.source?.url ?? null;
                const previewUrl = f?.preview?.url ?? null;
                const thumbUrl = f?.thumb?.url ?? f?.squarePreview?.url ?? null;
                if (!fullUrl && !previewUrl && !thumbUrl) continue;
                await prisma.outboundMedia.create({
                  data: {
                    creativeId: row.id,
                    mediaType: med.type || "photo",
                    fullUrl, previewUrl, thumbUrl,
                    duration: med.duration ?? null,
                    width: med.width ?? null,
                    height: med.height ?? null,
                  },
                });
              }
            }
          }

          postPages++;
          postPath = nextPage || undefined;
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err: any) {
        console.error(`[Backfill Posts] ${creator.name}: ${err.message}`);
      }
    }

    return { totalUpserted, totalMedia, totalPosts, creators: creators.length, results };
  },
});

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

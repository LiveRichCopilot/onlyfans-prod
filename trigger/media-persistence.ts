/**
 * Media Persistence Task
 *
 * Downloads media from OF CDN (before URLs expire) and uploads to
 * Supabase Storage. Stores permanent URL on OutboundMedia row.
 */
import { task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "" } },
});

const BUCKET = "content-media";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Trigger.dev env vars");
  return createClient(url, key);
}

export const mediaPersistence = task({
  id: "media-persistence",
  retry: { maxAttempts: 2 },
  run: async (payload: { limit?: number }) => {
    const supabase = getSupabase();
    const limit = payload.limit || 30;

    // Find media without permanentUrl that has a CDN URL
    const media = await prisma.outboundMedia.findMany({
      where: {
        permanentUrl: null,
        OR: [
          { fullUrl: { not: null } },
          { previewUrl: { not: null } },
          { thumbUrl: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, creativeId: true, mediaType: true,
        fullUrl: true, previewUrl: true, thumbUrl: true,
      },
    });

    if (media.length === 0) {
      return { persisted: 0, message: "No media needing persistence" };
    }

    let persisted = 0;
    let errors = 0;

    for (const m of media) {
      // Pick best available URL: full > preview > thumb
      const sourceUrl = m.fullUrl || m.previewUrl || m.thumbUrl;
      if (!sourceUrl) continue;

      try {
        // Download from CDN via proxy
        const apiKey = (process.env.OFAPI_API_KEY || "").trim();
        // Get the creator's account ID for the download endpoint
        const creative = await prisma.outboundCreative.findUnique({
          where: { id: m.creativeId },
          select: { creatorId: true },
        });
        if (!creative) continue;

        const creator = await prisma.creator.findUnique({
          where: { id: creative.creatorId },
          select: { ofapiCreatorId: true },
        });
        if (!creator?.ofapiCreatorId) continue;

        // Use OFAPI media download endpoint to get the actual file
        const downloadUrl = `https://app.onlyfansapi.com/api/${creator.ofapiCreatorId}/media/download/${sourceUrl}`;
        const res = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          // CDN URL may have expired, try preview/thumb as fallback
          console.error(`[Media] ${m.id}: download failed ${res.status}`);
          errors++;
          continue;
        }

        const blob = await res.arrayBuffer();
        const ext = m.mediaType === "video" ? "mp4" : m.mediaType === "audio" ? "mp3" : "jpg";
        const path = `${creative.creatorId}/${m.creativeId}/${m.id}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, Buffer.from(blob), {
            contentType: res.headers.get("content-type") || `image/${ext}`,
            upsert: true,
          });

        if (uploadErr) {
          console.error(`[Media] ${m.id}: upload failed`, uploadErr.message);
          errors++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const permanentUrl = urlData.publicUrl;

        // Save to DB
        await prisma.outboundMedia.update({
          where: { id: m.id },
          data: { permanentUrl },
        });

        persisted++;
        console.log(`[Media] ${m.id}: saved to ${path}`);

        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 300));
      } catch (e: any) {
        console.error(`[Media] ${m.id}: ${e.message}`);
        errors++;
      }
    }

    return { persisted, errors, total: media.length };
  },
});

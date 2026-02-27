/**
 * Supabase Storage client for uploading Hubstaff screenshots.
 * Screenshots are stored permanently in the "screenshots" bucket.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var for server-side uploads.
 * Falls back gracefully if not configured — screenshots just won't be cached.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "screenshots";

export function isStorageConfigured(): boolean {
  return !!(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/**
 * Upload a screenshot image from a URL to Supabase Storage.
 * Returns the permanent public URL, or null if upload fails.
 *
 * Path format: screenshots/{userId}/{date}/{screenshotId}.jpg
 */
export async function uploadScreenshot(
  hubstaffUrl: string,
  userId: number,
  screenshotId: number,
  recordedAt: string,
): Promise<{ url: string; thumbUrl: string } | null> {
  if (!isStorageConfigured()) return null;

  try {
    // Download from Hubstaff
    const imgRes = await fetch(hubstaffUrl);
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await imgRes.arrayBuffer();

    // Build path: {userId}/{YYYY-MM-DD}/{screenshotId}.jpg
    const date = recordedAt.slice(0, 10);
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${userId}/${date}/${screenshotId}.${ext}`;

    // Upload to Supabase Storage
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`[supabase-storage] Upload failed for ${screenshotId}:`, uploadRes.status, errText);
      return null;
    }

    // Public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    return {
      url: publicUrl,
      thumbUrl: publicUrl, // Same URL for now — could generate thumbs later
    };
  } catch (err: any) {
    console.error(`[supabase-storage] Error uploading ${screenshotId}:`, err.message);
    return null;
  }
}

/**
 * Batch upload screenshots. Processes in parallel batches of 5.
 */
export async function uploadScreenshotBatch(
  screenshots: { id: number; url: string; user_id: number; recorded_at: string }[],
): Promise<Map<number, { url: string; thumbUrl: string }>> {
  const results = new Map<number, { url: string; thumbUrl: string }>();

  if (!isStorageConfigured()) return results;

  const batchSize = 5;
  for (let i = 0; i < screenshots.length; i += batchSize) {
    const batch = screenshots.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (ss) => {
        const uploaded = await uploadScreenshot(ss.url, ss.user_id, ss.id, ss.recorded_at);
        return { id: ss.id, uploaded };
      }),
    );
    for (const r of batchResults) {
      if (r.uploaded) results.set(r.id, r.uploaded);
    }
  }

  return results;
}

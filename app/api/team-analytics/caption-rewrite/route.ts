import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/team-analytics/caption-rewrite
 *
 * Body: { postId: string } OR { caption: string, mediaTypes: string[] }
 *
 * Uses Kimi 2.5 (moonshot-v1-8k) to suggest 5 alternative captions
 * for PPV messages that didn't convert to sales.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, caption, mediaTypes } = body as {
      postId?: string;
      caption?: string;
      mediaTypes?: string[];
    };

    let finalCaption: string;
    let finalMediaTypes: string[];

    if (postId) {
      // Look up the OutboundCreative by ID, include its media
      const creative = await prisma.outboundCreative.findUnique({
        where: { id: postId },
        include: { media: { select: { mediaType: true } } },
      });

      if (!creative) {
        return NextResponse.json(
          { error: "OutboundCreative not found" },
          { status: 404 }
        );
      }

      finalCaption = creative.textPlain || creative.textHtml || "";
      finalMediaTypes = creative.media.map((m) => m.mediaType);
    } else if (caption) {
      finalCaption = caption;
      finalMediaTypes = mediaTypes || [];
    } else {
      return NextResponse.json(
        { error: "Provide either postId or caption" },
        { status: 400 }
      );
    }

    if (!finalCaption.trim()) {
      return NextResponse.json(
        { error: "Caption is empty — nothing to rewrite" },
        { status: 400 }
      );
    }

    const apiKey = (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "KIMI_API_KEY / MOONSHOT_API_KEY not configured" },
        { status: 500 }
      );
    }

    const mediaDesc =
      finalMediaTypes.length > 0
        ? finalMediaTypes.join(", ")
        : "unknown media";

    const systemPrompt =
      "You are a top-performing OnlyFans caption writer. Return ONLY a numbered list of 5 captions, nothing else.";

    const userPrompt = `This is a PPV message caption for an OnlyFans creator. The media includes ${mediaDesc}. The current caption didn't convert to sales. Suggest 5 alternative captions with better hooks and CTAs. Be spicy but not explicit. Format as numbered list.\n\nOriginal caption:\n${finalCaption}`;

    const kimiRes = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!kimiRes.ok) {
      const errText = await kimiRes.text();
      console.error("[caption-rewrite] Kimi API error:", kimiRes.status, errText);
      return NextResponse.json(
        { error: `Kimi API error: ${kimiRes.status}` },
        { status: 502 }
      );
    }

    const kimiData = await kimiRes.json();
    const rawContent: string =
      kimiData?.choices?.[0]?.message?.content || "";

    // Parse numbered list into array
    const suggestions = rawContent
      .split(/\n/)
      .map((line: string) => line.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter((line: string) => line.length > 0);

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[caption-rewrite] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

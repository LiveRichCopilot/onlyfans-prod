import { NextResponse } from "next/server";
import { rewriteMessage } from "@/lib/ai-ghost-writer";
import type { GhostWriteTone } from "@/lib/ai-ghost-writer";

export const dynamic = "force-dynamic";

/**
 * POST /api/inbox/ghost-write
 *
 * Body: { text, tone, fanContext? }
 * Returns: { rewritten: string }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text, tone, fanContext } = body;

        if (!text || !tone) {
            return NextResponse.json({ error: "Missing text or tone" }, { status: 400 });
        }

        const validTones: GhostWriteTone[] = ["the_tease", "the_commander", "the_girlfriend", "the_brat", "the_sweet"];
        if (!validTones.includes(tone)) {
            return NextResponse.json({ error: `Invalid tone. Must be one of: ${validTones.join(", ")}` }, { status: 400 });
        }

        const rewritten = await rewriteMessage(text, tone, fanContext);

        if (!rewritten) {
            return NextResponse.json({ error: "Ghost-writing failed" }, { status: 500 });
        }

        return NextResponse.json({ rewritten, tone });
    } catch (e: any) {
        console.error("[Ghost Write] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

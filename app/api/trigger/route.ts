/**
 * Trigger.dev API Route — manually trigger analysis tasks
 *
 * POST /api/trigger { task: "sale-attribution" | "phrase-mining" | "tactic-aggregator", payload?: {...} }
 */
import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import type { saleAttributionTask } from "@/trigger/sale-attribution";
import type { phraseMiningTask } from "@/trigger/phrase-mining";
import type { tacticAggregatorTask } from "@/trigger/tactic-aggregator";

export const dynamic = "force-dynamic";

const VALID_TASKS = ["sale-attribution", "phrase-mining", "tactic-aggregator"] as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task: taskId, payload } = body;

    if (!taskId || !VALID_TASKS.includes(taskId)) {
      return NextResponse.json(
        { error: `Invalid task. Must be one of: ${VALID_TASKS.join(", ")}` },
        { status: 400 }
      );
    }

    const handle = await tasks.trigger(taskId, payload || {});

    return NextResponse.json({
      ok: true,
      taskId,
      runId: handle.id,
    });
  } catch (e: any) {
    console.error("[Trigger API]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

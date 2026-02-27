import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatMessages } from "@/lib/ofapi";
import { stripHtml } from "@/lib/ai-classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OPENAI_BASE = "https://api.openai.com/v1/chat/completions";

/**
 * POST /api/inbox/qa-score
 *
 * Body: { creatorId, chatId, chatterId? }
 *
 * Fetches last 50 messages, scores via GPT-4o-mini rubric:
 * - Control (0-5): Did the chatter lead the conversation?
 * - Tension (0-5): Was there sexual/emotional tension building?
 * - Value (0-5): Were there clear CTAs and value propositions?
 * - Personalization (0-5): Did they use fan's name/interests/facts?
 * - Compliance (pass/fail): No ToS violations, no real phone/social
 *
 * Saves to ChatQAReview model.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { creatorId, chatId, chatterId } = body;

        if (!creatorId || !chatId) {
            return NextResponse.json({ error: "Missing creatorId or chatId" }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
        }

        const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
        if (!creator?.ofapiToken || !creator.ofapiCreatorId) {
            return NextResponse.json({ error: "Creator not configured" }, { status: 400 });
        }

        // Fetch last 50 messages
        const msgData = await getChatMessages(
            creator.ofapiCreatorId,
            chatId,
            creator.ofapiToken,
            50,
        );
        const rawMsgs = msgData?.data?.list || msgData?.list || (Array.isArray(msgData?.data) ? msgData.data : []);

        if (rawMsgs.length === 0) {
            return NextResponse.json({ error: "No messages found" }, { status: 404 });
        }

        // Format messages for QA
        const formatted = rawMsgs
            .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((m: any) => {
                const fromId = m.fromUser?.id || m.author?.id || "";
                const isCreator = fromId !== chatId;
                const text = stripHtml(m.text || "");
                return `[${isCreator ? "CHATTER" : "FAN"}]: ${text}`;
            })
            .filter((l: string) => l.length > 15)
            .join("\n");

        // QA scoring prompt
        const qaPrompt = `Score this OnlyFans conversation between a CHATTER (agent) and a FAN.

Conversation:
${formatted}

Score each dimension 0-5:
- control: Did the chatter lead? Or did the fan control the conversation?
- tension: Was there sexual/emotional tension? Push-pull dynamics?
- value: Clear CTAs? Did they pitch content, customs, tips?
- personalization: Used fan's name/details? Felt personal vs generic?
- compliance: Pass (true) or fail (false) — no real phone numbers, no real social media, no meeting up, no underage references

Also detect:
- mistakeTags: Common mistakes (permission_asking, flat_ack, no_cta, discount_too_fast, begging, too_available)
- strengthTags: Good moves (good_push_pull, strong_cta, adapted_to_fan, built_tension, personal_bridge, created_urgency)
- agentStyle: Overall style (direct, playful, warm, efficient, dominant, submissive)
- outcome: What happened? (ppv_bought, no_sale, follow_up_set, engagement_only)

Return ONLY valid JSON:
{
  "controlScore": 0-5,
  "tensionScore": 0-5,
  "valueScore": 0-5,
  "personalizationScore": 0-5,
  "compliancePass": true/false,
  "mistakeTags": ["string"],
  "strengthTags": ["string"],
  "agentStyle": "string",
  "outcome": "string",
  "notes": "1-2 sentence summary of what went well/badly"
}`;

        const response = await fetch(OPENAI_BASE, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are an expert QA reviewer for an OnlyFans chatting agency. Be honest and specific." },
                    { role: "user", content: qaPrompt },
                ],
                temperature: 0.2,
                max_completion_tokens: 500,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: "QA scoring failed" }, { status: 500 });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            return NextResponse.json({ error: "Empty QA response" }, { status: 500 });
        }

        const scores = JSON.parse(content);

        // Save to DB
        const review = await prisma.chatQAReview.create({
            data: {
                creatorId,
                chatterId: chatterId || null,
                chatId,
                controlScore: scores.controlScore || 0,
                tensionScore: scores.tensionScore || 0,
                valueScore: scores.valueScore || 0,
                personalizationScore: scores.personalizationScore || 0,
                compliancePass: scores.compliancePass !== false,
                mistakeTags: Array.isArray(scores.mistakeTags) ? scores.mistakeTags : [],
                strengthTags: Array.isArray(scores.strengthTags) ? scores.strengthTags : [],
                agentStyle: scores.agentStyle || null,
                outcome: scores.outcome || null,
                notes: scores.notes || null,
            },
        });

        return NextResponse.json({ review, scores });
    } catch (e: any) {
        console.error("[QA Score] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/inbox/fan-tag — Save a preference tag or fact for a fan
 *
 * Body: {
 *   fanOfapiId: string,      // OFAPI fan ID
 *   creatorId: string,        // Creator DB ID
 *   action: "add_preference" | "remove_preference" | "add_fact" | "remove_fact" | "set_field",
 *   tag?: string,             // For preferences: "roleplay", "customs", etc.
 *   weight?: number,          // For preferences: 1-10
 *   key?: string,             // For facts: "hobby", "pet_name", etc.
 *   value?: string,           // For facts or set_field
 *   field?: string,           // For set_field: "fanType", "stage", "tonePreference", etc.
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fanOfapiId, creatorId, action } = body;

        if (!fanOfapiId || !creatorId || !action) {
            return NextResponse.json({ error: "Missing fanOfapiId, creatorId, or action" }, { status: 400 });
        }

        // Find or create the fan
        let fan = await prisma.fan.findFirst({
            where: { ofapiFanId: fanOfapiId, creatorId },
        });

        if (!fan) {
            fan = await prisma.fan.create({
                data: { ofapiFanId: fanOfapiId, creatorId },
            });
        }

        switch (action) {
            case "add_preference": {
                const { tag, weight } = body;
                if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });

                await prisma.fanPreference.upsert({
                    where: { fanId_tag: { fanId: fan.id, tag } },
                    create: {
                        fanId: fan.id,
                        tag,
                        weight: weight || 1.0,
                        source: "manual",
                    },
                    update: {
                        weight: weight || 1.0,
                        lastSeenAt: new Date(),
                        source: "manual",
                    },
                });

                return NextResponse.json({ success: true, action: "add_preference", tag });
            }

            case "remove_preference": {
                const { tag } = body;
                if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });

                await prisma.fanPreference.deleteMany({
                    where: { fanId: fan.id, tag },
                });

                return NextResponse.json({ success: true, action: "remove_preference", tag });
            }

            case "add_fact": {
                const { key, value } = body;
                if (!key || !value) return NextResponse.json({ error: "Missing key or value" }, { status: 400 });

                await prisma.fanFact.upsert({
                    where: { fanId_key: { fanId: fan.id, key } },
                    create: {
                        fanId: fan.id,
                        key,
                        value,
                        confidence: 1.0,
                        source: "manual",
                    },
                    update: {
                        value,
                        confidence: 1.0,
                        source: "manual",
                        lastConfirmedAt: new Date(),
                    },
                });

                return NextResponse.json({ success: true, action: "add_fact", key, value });
            }

            case "remove_fact": {
                const { key } = body;
                if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

                await prisma.fanFact.deleteMany({
                    where: { fanId: fan.id, key },
                });

                return NextResponse.json({ success: true, action: "remove_fact", key });
            }

            case "set_field": {
                const { field, value } = body;
                if (!field) return NextResponse.json({ error: "Missing field" }, { status: 400 });

                // Whitelist of allowed fields
                const allowed = [
                    "fanType", "tonePreference", "stage", "buyerType",
                    "priceRange", "formatPreference", "bestOpenerType",
                    "bestOfferType", "narrativeSummary", "emotionalDrivers",
                    "emotionalNeeds", "nextBestAction", "nextBestActionReason",
                ];

                if (!allowed.includes(field)) {
                    return NextResponse.json({ error: `Field '${field}' not allowed` }, { status: 400 });
                }

                await prisma.fan.update({
                    where: { id: fan.id },
                    data: { [field]: value || null },
                });

                // Log lifecycle event for stage changes
                if (field === "stage") {
                    await prisma.fanLifecycleEvent.create({
                        data: {
                            fanId: fan.id,
                            type: "stage_change",
                            metadata: { to: value, source: "manual" },
                        },
                    });
                }

                return NextResponse.json({ success: true, action: "set_field", field, value });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (e: any) {
        console.error("Fan tag error:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

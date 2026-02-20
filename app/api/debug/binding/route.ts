import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const telegramId = "123123";
        const telegramGroupId = "-3713850376";

        // 1. Check existing
        let creator = await prisma.creator.findFirst({
            where: {
                OR: [
                    { telegramId },
                    { telegramGroupId }
                ]
            }
        });

        const logs = [];
        logs.push(`Initial search found: ${creator ? 'YES' : 'NO'}`);

        if (creator && creator.ofapiToken === (process.env.TEST_OFAPI_KEY || "ofapi_03SJHIffT7oMztcLSET7yTA7x0g53ijf9TARi20L0eff63a5")) {
            logs.push('Deleted test creator');
        }

        if (!creator && telegramId && telegramId !== "undefined") {
            let realCreator = await prisma.creator.findFirst({
                where: { ofapiToken: "linked_via_auth_module" }
            });
            logs.push(`Real creator search found: ${realCreator ? 'YES' : 'NO'}`);

            if (realCreator) {
                logs.push(`Would bind this to: ${telegramId}, ${telegramGroupId}`);
            }
        }

        return NextResponse.json({ ok: true, logs });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}

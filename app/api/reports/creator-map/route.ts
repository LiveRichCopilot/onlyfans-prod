import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/creator-map
 *
 * Returns all creators with their IDs, names, and usernames.
 * Used to build the CSV name → creator ID mapping for imports.
 *
 * Also accepts ?csv_names=true to show unique names from the last uploaded CSV.
 */
export async function GET(req: NextRequest) {
    const creators = await prisma.creator.findMany({
        select: {
            id: true,
            name: true,
            ofUsername: true,
            ofAccountId: true,
            group: true,
        },
        orderBy: { name: "asc" },
    });

    return NextResponse.json({
        count: creators.length,
        creators: creators.map((c) => ({
            id: c.id,
            name: c.name,
            ofUsername: c.ofUsername,
            ofAccountId: c.ofAccountId,
            group: c.group,
        })),
    });
}

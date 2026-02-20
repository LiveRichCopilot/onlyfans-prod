import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        // Fetch all users with the EMPLOYEE role, including their assigned creators
        const employees = await prisma.user.findMany({
            where: {
                role: "EMPLOYEE"
            },
            include: {
                assignments: {
                    include: {
                        creator: true
                    }
                }
            }
        });

        // Also fetch all active creators so the UI can populate the "Assign" dropdown
        const allCreators = await prisma.creator.findMany({
            orderBy: { name: 'asc' }
        });

        // Simulate a fake chat manager if empty for demo purposes (Vercel DB not seeded)
        if (employees.length === 0) {
            employees.push({
                id: "fake-1",
                name: "Davidson (Demo Chatter)",
                email: "davidson@agency.com",
                role: "EMPLOYEE",
                assignments: []
            } as any);
        }

        return NextResponse.json({
            employees,
            availableCreators: allCreators
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { userId, creatorId, action } = await request.json();

        if (!userId || !creatorId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (action === "ASSIGN") {
            await prisma.creatorAssignment.create({
                data: {
                    userId,
                    creatorId
                }
            });
        } else if (action === "REVOKE") {
            await prisma.creatorAssignment.deleteMany({
                where: {
                    userId,
                    creatorId
                }
            });
        }

        return NextResponse.json({ success: true, action });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

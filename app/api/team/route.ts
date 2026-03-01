import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-gateway";
import { prisma } from "@/lib/prisma";
import { applyRoleTemplate } from "@/lib/role-templates";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    ACCOUNT_EXEC: "Team Manager",
    MANAGER: "Account Manager",
    AGENT: "Chatter",
    VIEWER: "Analyst",
};

const TEMPLATE_FOR_ROLE: Record<string, string> = {
    OWNER: "owner",
    ADMIN: "admin",
    ACCOUNT_EXEC: "account_executive",
    MANAGER: "manager",
    AGENT: "chatter",
    VIEWER: "analyst",
};

export async function GET() {
    try {
        const auth = await requireAuth();
        if (!auth.orgId) {
            return NextResponse.json({ members: [], pendingInvites: [], creators: [] });
        }

        const orgMembers = await prisma.orgMember.findMany({
            where: { organizationId: auth.orgId },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        const accountAccessRows = await prisma.memberAccountAccess.findMany({
            where: { organizationId: auth.orgId },
            select: { userId: true, creatorId: true },
        });

        const managerRows = await prisma.managerAccountResponsibility.findMany({
            where: { organizationId: auth.orgId },
            select: { managerId: true, creatorId: true },
        });

        // Creators are not yet org-scoped (organizationId is NULL on all rows).
        // Fetch all creators — matches every other query in the codebase.
        // TODO: filter by organizationId once creators are assigned to orgs.
        const allCreators = await prisma.creator.findMany({
            where: { active: true },
            select: { id: true, name: true, avatarUrl: true },
            orderBy: { name: "asc" },
        });

        const members = orgMembers.map((m) => {
            const memberAccess = accountAccessRows
                .filter((a) => a.userId === m.userId)
                .map((a) => a.creatorId);
            const mgrAccess = managerRows
                .filter((r) => r.managerId === m.userId)
                .map((r) => r.creatorId);
            const allAccess = [...new Set([...memberAccess, ...mgrAccess])];

            return {
                id: m.id,
                userId: m.userId,
                name: m.user.name || "Unknown",
                email: m.user.email || "",
                image: m.user.image || null,
                role: m.role,
                roleLabel: ROLE_LABELS[m.role] || m.role,
                accountIds: allAccess,
                accountCount: allAccess.length,
            };
        });

        const pendingInvites = await prisma.invite.findMany({
            where: {
                organizationId: auth.orgId,
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });

        const invites = pendingInvites.map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            roleLabel: ROLE_LABELS[inv.role] || inv.role,
        }));

        return NextResponse.json({
            members,
            pendingInvites: invites,
            creators: allCreators,
            currentUserId: auth.userId,
        });
    } catch (error: any) {
        console.error("Team GET error:", error);
        return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAuth();
        if (!auth.orgId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const body = await request.json();
        const { action } = body;

        if (action === "INVITE") return handleInvite(auth.orgId, body);
        if (action === "UPDATE_ROLE") return handleUpdateRole(auth.orgId, body);
        if (action === "ASSIGN_ACCOUNTS") return handleAssignAccounts(auth.orgId, body);
        if (action === "REMOVE_MEMBER") return handleRemoveMember(auth.orgId, body);
        if (action === "CANCEL_INVITE") return handleCancelInvite(auth.orgId, body);

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (error: any) {
        console.error("Team POST error:", error);
        return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
}

async function handleInvite(orgId: string, body: any) {
    const { email, role } = body;
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const orgRole = role || "AGENT";
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
        const existingMember = await prisma.orgMember.findFirst({
            where: { userId: existingUser.id, organizationId: orgId },
        });
        if (existingMember) {
            return NextResponse.json({ error: "Already a team member" }, { status: 400 });
        }
    }

    const existingInvite = await prisma.invite.findFirst({
        where: { email, organizationId: orgId, acceptedAt: null },
    });
    if (existingInvite) {
        return NextResponse.json({ error: "Invite already pending" }, { status: 400 });
    }

    const invite = await prisma.invite.create({
        data: {
            email,
            role: orgRole,
            roleTemplate: TEMPLATE_FOR_ROLE[orgRole] || "chatter",
            organizationId: orgId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    });

    // If user already has an account, auto-accept immediately
    if (existingUser) {
        // Upsert guards against race conditions on the unique(userId, organizationId)
        await prisma.orgMember.upsert({
            where: {
                userId_organizationId: {
                    userId: existingUser.id,
                    organizationId: orgId,
                },
            },
            create: {
                userId: existingUser.id,
                organizationId: orgId,
                role: orgRole,
                roleTemplate: TEMPLATE_FOR_ROLE[orgRole] || "chatter",
            },
            update: {
                role: orgRole,
                roleTemplate: TEMPLATE_FOR_ROLE[orgRole] || "chatter",
            },
        });
        await prisma.user.update({
            where: { id: existingUser.id },
            data: { organizationId: orgId, role: "EMPLOYEE" },
        });
        await applyRoleTemplate(orgId, existingUser.id, TEMPLATE_FOR_ROLE[orgRole] || "chatter");
        await prisma.invite.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date() },
        });
        return NextResponse.json({ success: true, autoAccepted: true });
    }

    return NextResponse.json({ success: true, inviteId: invite.id });
}

async function handleUpdateRole(orgId: string, body: any) {
    const { memberId, newRole } = body;
    if (!memberId || !newRole) {
        return NextResponse.json({ error: "memberId and newRole required" }, { status: 400 });
    }

    const member = await prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.organizationId !== orgId) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (member.role === "OWNER") {
        return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
    }

    await prisma.orgMember.update({
        where: { id: memberId },
        data: { role: newRole, roleTemplate: TEMPLATE_FOR_ROLE[newRole] || null },
    });

    await prisma.memberPermission.deleteMany({
        where: { organizationId: orgId, userId: member.userId },
    });
    if (TEMPLATE_FOR_ROLE[newRole]) {
        await applyRoleTemplate(orgId, member.userId, TEMPLATE_FOR_ROLE[newRole]);
    }

    return NextResponse.json({ success: true });
}

async function handleAssignAccounts(orgId: string, body: any) {
    const { userId, creatorIds } = body;
    if (!userId || !Array.isArray(creatorIds)) {
        return NextResponse.json({ error: "userId and creatorIds array required" }, { status: 400 });
    }

    const member = await prisma.orgMember.findFirst({
        where: { userId, organizationId: orgId },
    });
    if (!member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Clear org-scoped access tables
    await prisma.memberAccountAccess.deleteMany({ where: { organizationId: orgId, userId } });
    await prisma.managerAccountResponsibility.deleteMany({ where: { organizationId: orgId, managerId: userId } });

    // CreatorAssignment has no organizationId column.
    // Single-org system currently: safe to delete by userId.
    // TODO: When Creator.organizationId is populated, scope this delete to org creators only.
    await prisma.creatorAssignment.deleteMany({ where: { userId } });

    if (creatorIds.length > 0) {
        await prisma.memberAccountAccess.createMany({
            data: creatorIds.map((cid: string) => ({ organizationId: orgId, userId, creatorId: cid })),
            skipDuplicates: true,
        });

        if (member.role === "MANAGER" || member.role === "ACCOUNT_EXEC") {
            await prisma.managerAccountResponsibility.createMany({
                data: creatorIds.map((cid: string) => ({ organizationId: orgId, managerId: userId, creatorId: cid })),
                skipDuplicates: true,
            });
        }

        // Backward compat with hourly breakdown API (uses CreatorAssignment)
        await prisma.creatorAssignment.createMany({
            data: creatorIds.map((cid: string) => ({ userId, creatorId: cid })),
            skipDuplicates: true,
        });
    }

    return NextResponse.json({ success: true });
}

async function handleRemoveMember(orgId: string, body: any) {
    const { memberId } = body;
    if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

    const member = await prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!member || member.organizationId !== orgId) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (member.role === "OWNER") {
        return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }

    await prisma.memberAccountAccess.deleteMany({ where: { organizationId: orgId, userId: member.userId } });
    await prisma.managerAccountResponsibility.deleteMany({ where: { organizationId: orgId, managerId: member.userId } });
    await prisma.memberPermission.deleteMany({ where: { organizationId: orgId, userId: member.userId } });
    // Single-org: safe to clear all. TODO: scope once creators are org-assigned.
    await prisma.creatorAssignment.deleteMany({ where: { userId: member.userId } });
    await prisma.orgMember.delete({ where: { id: memberId } });
    await prisma.user.update({
        where: { id: member.userId },
        data: { organizationId: null, role: "UNASSIGNED" },
    });

    return NextResponse.json({ success: true });
}

// Org-scoped: only deletes if invite belongs to this org and is not yet accepted
async function handleCancelInvite(orgId: string, body: any) {
    const { inviteId } = body;
    if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 });

    await prisma.invite.deleteMany({
        where: { id: inviteId, organizationId: orgId, acceptedAt: null },
    });

    return NextResponse.json({ success: true });
}

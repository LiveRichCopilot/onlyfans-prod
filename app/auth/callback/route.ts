import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { applyRoleTemplate } from "@/lib/role-templates";
import { NextResponse } from "next/server";

const TEMPLATE_FOR_ROLE: Record<string, string> = {
    OWNER: "owner",
    ADMIN: "admin",
    ACCOUNT_EXEC: "account_executive",
    MANAGER: "manager",
    AGENT: "chatter",
    VIEWER: "analyst",
};

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user?.email) {
                let prismaUser = await prisma.user.findUnique({
                    where: { email: user.email },
                    select: { id: true, organizationId: true, role: true },
                });

                // Check if user needs onboarding OR has a pending invite
                if (!prismaUser || !prismaUser.organizationId || prismaUser.role === "UNASSIGNED") {
                    // Look for pending invite matching this email
                    const pendingInvite = await prisma.invite.findFirst({
                        where: {
                            email: user.email,
                            acceptedAt: null,
                            expiresAt: { gt: new Date() },
                        },
                        orderBy: { createdAt: "desc" },
                    });

                    if (pendingInvite) {
                        // Create user if needed
                        if (!prismaUser) {
                            const created = await prisma.user.create({
                                data: {
                                    email: user.email,
                                    name: user.user_metadata?.full_name || user.email.split("@")[0],
                                },
                            });
                            prismaUser = { id: created.id, organizationId: null, role: "UNASSIGNED" };
                        }

                        // Join the org
                        await prisma.orgMember.upsert({
                            where: {
                                userId_organizationId: {
                                    userId: prismaUser.id,
                                    organizationId: pendingInvite.organizationId,
                                },
                            },
                            create: {
                                userId: prismaUser.id,
                                organizationId: pendingInvite.organizationId,
                                role: pendingInvite.role,
                                roleTemplate: pendingInvite.roleTemplate || TEMPLATE_FOR_ROLE[pendingInvite.role] || "chatter",
                            },
                            update: {},
                        });

                        await prisma.user.update({
                            where: { id: prismaUser.id },
                            data: {
                                organizationId: pendingInvite.organizationId,
                                role: "EMPLOYEE",
                            },
                        });

                        // Apply role permissions
                        const template = pendingInvite.roleTemplate || TEMPLATE_FOR_ROLE[pendingInvite.role] || "chatter";
                        await applyRoleTemplate(pendingInvite.organizationId, prismaUser.id, template);

                        // Mark invite accepted
                        await prisma.invite.update({
                            where: { id: pendingInvite.id },
                            data: { acceptedAt: new Date() },
                        });

                        // Skip onboarding, go straight to dashboard
                        return NextResponse.redirect(`${origin}/`);
                    }

                    // No invite found — needs onboarding
                    return NextResponse.redirect(`${origin}/onboarding`);
                }
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

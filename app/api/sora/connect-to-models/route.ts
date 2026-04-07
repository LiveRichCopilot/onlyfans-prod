import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSoraAuthSafe, isAdmin } from "@/lib/sora-access";

export const dynamic = "force-dynamic";

/**
 * POST /api/sora/connect-to-models
 *
 * Idempotent admin-only setup. Jay's exact phrase from 2026-04-06:
 * "connect her to those, her models, and we can connect it to those accounts as her manager"
 *
 * What it does:
 *   1. Ensures User rows exist for sora@, jay@, david@liverich.travel
 *   2. Ensures each is an OrgMember with role MANAGER in the org
 *   3. Creates ManagerAccountResponsibility rows linking each to Sora's 6 models:
 *      Kaylie (2 pages), Anna Cherie (2 pages), Angie, Wendy
 *
 * Matching is fuzzy on Creator.name and Creator.ofUsername (case-insensitive).
 * Returns what it matched so you can visually confirm nothing is missed.
 *
 * Body (optional): { modelIds?: string[] }
 *   If passed, uses those exact Creator IDs instead of fuzzy name matching.
 */

const SORA_MODEL_NAMES = ["kaylie", "anna cherie", "anna", "angie", "wendy"];
const TEAM_EMAILS = ["sora@liverich.travel", "jay@liverich.travel", "david@liverich.travel"];

export async function POST(req: Request) {
  try {
    const ctx = await getSoraAuthSafe();
    if (!ctx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!isAdmin(ctx)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const explicitModelIds: string[] | undefined = Array.isArray(body.modelIds) ? body.modelIds : undefined;

    // 1. Find the organization (pick the first — single-org per Jay's setup)
    let org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (!org) {
      return NextResponse.json(
        { error: "No organization found. Create one before running this setup." },
        { status: 400 }
      );
    }

    // 2. Find or create User rows for each team member
    const teamUsers: Array<{ email: string; userId: string; created: boolean }> = [];
    for (const teamEmail of TEAM_EMAILS) {
      let user = await prisma.user.findUnique({ where: { email: teamEmail } });
      let created = false;
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: teamEmail,
            role: "EMPLOYEE",
            organizationId: org.id,
          },
        });
        created = true;
      } else if (!user.organizationId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { organizationId: org.id },
        });
      }
      teamUsers.push({ email: teamEmail, userId: user.id, created });

      // Make sure each has an OrgMember row with MANAGER role
      const existingMember = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      });
      if (!existingMember) {
        await prisma.orgMember.create({
          data: { userId: user.id, organizationId: org.id, role: "MANAGER" },
        });
      }
    }

    // 3. Resolve Sora's 6 models
    let models: Array<{ id: string; name: string | null; ofUsername: string | null }> = [];

    if (explicitModelIds && explicitModelIds.length > 0) {
      models = await prisma.creator.findMany({
        where: { id: { in: explicitModelIds } },
        select: { id: true, name: true, ofUsername: true },
      });
    } else {
      const allCreators = await prisma.creator.findMany({
        where: { active: true },
        select: { id: true, name: true, ofUsername: true },
      });
      models = allCreators.filter((c: typeof allCreators[number]) => {
        const n = (c.name || "").toLowerCase();
        const u = (c.ofUsername || "").toLowerCase();
        return SORA_MODEL_NAMES.some((target) => n.includes(target) || u.includes(target));
      });
    }

    // 4. Create ManagerAccountResponsibility rows for each team member × each model
    const links: Array<{ email: string; modelName: string; created: boolean }> = [];
    for (const tu of teamUsers) {
      for (const model of models) {
        const existing = await prisma.managerAccountResponsibility.findUnique({
          where: {
            organizationId_managerId_creatorId: {
              organizationId: org.id,
              managerId: tu.userId,
              creatorId: model.id,
            },
          },
        });
        if (existing) {
          links.push({ email: tu.email, modelName: model.name || model.ofUsername || model.id, created: false });
          continue;
        }
        await prisma.managerAccountResponsibility.create({
          data: {
            organizationId: org.id,
            managerId: tu.userId,
            creatorId: model.id,
          },
        });
        links.push({ email: tu.email, modelName: model.name || model.ofUsername || model.id, created: true });
      }
    }

    return NextResponse.json({
      success: true,
      organization: { id: org.id, name: org.name },
      teamUsers,
      modelsFound: models.length,
      modelsConnected: models.map((m) => ({ id: m.id, name: m.name, ofUsername: m.ofUsername })),
      links,
      note:
        models.length === 6
          ? "Found all 6 expected models (Kaylie ×2, Anna Cherie ×2, Angie, Wendy)."
          : `Found ${models.length} models. Expected 6. Verify the modelsConnected list and rerun with { modelIds: [...] } if needed.`,
    });
  } catch (err: any) {
    console.error("[sora/connect-to-models]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

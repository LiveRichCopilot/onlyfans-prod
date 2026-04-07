import { prisma } from "@/lib/prisma";
import { requireAuth, type AuthContext } from "@/lib/auth-gateway";

/**
 * Sora tab access — v1.
 *
 * Every manager sees only their OWN models. Scoping goes through
 * the existing ManagerAccountResponsibility table (manager → creators).
 *
 * Admins (OWNER/ADMIN/ACCOUNT_EXEC orgRole, or jay@/david@liverich.travel
 * by email) see every active model and can run the Setup step that
 * seeds ManagerAccountResponsibility rows for the team.
 *
 * Uses Supabase Auth via auth-gateway.ts (not NextAuth — that's legacy).
 */

const GLOBAL_SCOPE_ORG_ROLES = new Set(["OWNER", "ADMIN", "ACCOUNT_EXEC"]);
const ADMIN_EMAILS = new Set(["jay@liverich.travel", "david@liverich.travel"]);

export function isAdmin(ctx: AuthContext): boolean {
  if (ctx.orgRole && GLOBAL_SCOPE_ORG_ROLES.has(ctx.orgRole)) return true;
  if (ctx.email && ADMIN_EMAILS.has(ctx.email.toLowerCase())) return true;
  return false;
}

export type SoraModel = {
  id: string;
  name: string;
  ofUsername: string | null;
  avatarUrl: string | null;
};

async function fetchModels(ids: string[]): Promise<SoraModel[]> {
  if (ids.length === 0) return [];
  const creators = await prisma.creator.findMany({
    where: { active: true, id: { in: ids } },
    select: { id: true, name: true, ofUsername: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });
  return creators.map((c: typeof creators[number]) => ({
    id: c.id,
    name: c.name || c.ofUsername || "Unknown",
    ofUsername: c.ofUsername,
    avatarUrl: c.avatarUrl,
  }));
}

/**
 * Models this user can see on the Sora tab.
 * - Admins → every active model
 * - Managers → models they own via ManagerAccountResponsibility
 */
export async function listModelsForUser(ctx: AuthContext): Promise<SoraModel[]> {
  if (isAdmin(ctx)) {
    const creators = await prisma.creator.findMany({
      where: { active: true },
      select: { id: true, name: true, ofUsername: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });
    return creators.map((c: typeof creators[number]) => ({
      id: c.id,
      name: c.name || c.ofUsername || "Unknown",
      ofUsername: c.ofUsername,
      avatarUrl: c.avatarUrl,
    }));
  }

  if (!ctx.orgId) return [];

  const responsibilities = await prisma.managerAccountResponsibility.findMany({
    where: { organizationId: ctx.orgId, managerId: ctx.userId },
    select: { creatorId: true },
  });
  return fetchModels(responsibilities.map((r: { creatorId: string }) => r.creatorId));
}

/**
 * Does this user have access to a specific model?
 * Admins → always. Others → must have a ManagerAccountResponsibility row.
 */
export async function canAccessModel(ctx: AuthContext, modelId: string): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  if (!ctx.orgId) return false;
  const row = await prisma.managerAccountResponsibility.findFirst({
    where: {
      organizationId: ctx.orgId,
      managerId: ctx.userId,
      creatorId: modelId,
    },
    select: { id: true },
  });
  return !!row;
}

/**
 * Returns the current AuthContext, or null if not logged in.
 * Never throws.
 */
export async function getSoraAuthSafe(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

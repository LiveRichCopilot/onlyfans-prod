import { prisma } from "@/lib/prisma";

/**
 * Sora tab access — v1.
 *
 * Allow list (Jay confirmed 2026-04-06):
 *   - admins (role AGENCY or CFO)
 *   - sora@liverich.travel
 *   - jay@liverich.travel
 *   - david@liverich.travel
 *
 * Anyone in this list can see the Sora tab. To access a specific model
 * behind the tab, they must either be in this allow list OR have a
 * ManagerAccountResponsibility row for that model.
 *
 * Future slice: Sora-editable email allow list stored in DB.
 */
const SORA_ALLOW_EMAILS = new Set([
  "sora@liverich.travel",
  "jay@liverich.travel",
  "david@liverich.travel",
]);

const ADMIN_ROLES = new Set(["AGENCY", "CFO"]);

export function isSoraAllowed(args: { email: string | null; role: string | null }): boolean {
  const { email, role } = args;
  if (role && ADMIN_ROLES.has(role)) return true;
  if (email && SORA_ALLOW_EMAILS.has(email.toLowerCase())) return true;
  return false;
}

export function isAdmin(args: { email: string | null; role: string | null }): boolean {
  const { email, role } = args;
  if (role && ADMIN_ROLES.has(role)) return true;
  if (email && (email === "jay@liverich.travel" || email === "david@liverich.travel")) return true;
  return false;
}

/**
 * Can this user see data for the given model?
 * Admins + allow list can see all models. Others need a ManagerAccountResponsibility row.
 */
export async function canAccessModel(args: {
  email: string | null;
  role: string | null;
  userId: string | null;
  modelId: string;
}): Promise<boolean> {
  if (isSoraAllowed({ email: args.email, role: args.role })) return true;
  if (!args.userId) return false;
  const row = await prisma.managerAccountResponsibility.findFirst({
    where: { managerId: args.userId, creatorId: args.modelId },
    select: { id: true },
  });
  return !!row;
}

/**
 * List the models this user can see on the Sora tab.
 * - Admins + allow list → all active models
 * - Others → only models they manage via ManagerAccountResponsibility
 */
export async function listModelsForUser(args: {
  email: string | null;
  role: string | null;
  userId: string | null;
}): Promise<Array<{ id: string; name: string; ofUsername: string | null; avatarUrl: string | null }>> {
  if (isSoraAllowed({ email: args.email, role: args.role })) {
    const creators = await prisma.creator.findMany({
      where: { active: true },
      select: { id: true, name: true, ofUsername: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });
    return creators.map((c) => ({
      id: c.id,
      name: c.name || c.ofUsername || "Unknown",
      ofUsername: c.ofUsername,
      avatarUrl: c.avatarUrl,
    }));
  }

  if (!args.userId) return [];

  const responsibilities = await prisma.managerAccountResponsibility.findMany({
    where: { managerId: args.userId },
    select: { creatorId: true },
  });
  const ids = responsibilities.map((r) => r.creatorId);
  if (ids.length === 0) return [];

  const creators = await prisma.creator.findMany({
    where: { active: true, id: { in: ids } },
    select: { id: true, name: true, ofUsername: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });
  return creators.map((c) => ({
    id: c.id,
    name: c.name || c.ofUsername || "Unknown",
    ofUsername: c.ofUsername,
    avatarUrl: c.avatarUrl,
  }));
}

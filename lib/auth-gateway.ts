import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// ─── Error Types ────────────────────────────────────────────────────

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(
    message: string,
    status: number = 401,
    code: string = "UNAUTHORIZED"
  ) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

// ─── Types ──────────────────────────────────────────────────────────

export type OrgRoleType =
  | "OWNER"
  | "ADMIN"
  | "ACCOUNT_EXEC"
  | "MANAGER"
  | "AGENT"
  | "VIEWER";

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  orgId: string | null;
  orgRole: OrgRoleType | null;
}

const DELEGATION_ROLES: OrgRoleType[] = [
  "OWNER",
  "ADMIN",
  "ACCOUNT_EXEC",
  "MANAGER",
];
const GLOBAL_SCOPE_ROLES: OrgRoleType[] = [
  "OWNER",
  "ADMIN",
  "ACCOUNT_EXEC",
];

// ─── Core Checks ────────────────────────────────────────────────────

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    throw new AuthError("Not authenticated", 401, "UNAUTHENTICATED");
  }

  // Find or create Prisma user by email
  let prismaUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!prismaUser) {
    prismaUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split("@")[0],
      },
    });
  }

  const membership = await prisma.orgMember.findFirst({
    where: { userId: prismaUser.id },
    select: { organizationId: true, role: true },
  });

  return {
    userId: prismaUser.id,
    email: prismaUser.email || "",
    role: prismaUser.role || "UNASSIGNED",
    orgId: membership?.organizationId || null,
    orgRole: (membership?.role as OrgRoleType) || null,
  };
}

export async function requireOrgMember(userId: string, orgId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  if (!member) {
    throw new AuthError(
      "Not a member of this organization",
      403,
      "NOT_ORG_MEMBER"
    );
  }
  return member;
}

export async function requireModule(orgId: string, moduleKey: string) {
  const mod = await prisma.orgModule.findUnique({
    where: {
      organizationId_moduleKey: { organizationId: orgId, moduleKey },
    },
  });
  if (!mod?.enabled) {
    throw new AuthError(
      `Module "${moduleKey}" is not enabled`,
      403,
      "MODULE_DISABLED"
    );
  }
}

export async function requirePermission(
  userId: string,
  orgId: string,
  permissionKey: string
) {
  // OWNER and ADMIN bypass permission checks
  const member = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    select: { role: true },
  });
  if (member?.role === "OWNER" || member?.role === "ADMIN") return;

  const perm = await prisma.memberPermission.findUnique({
    where: {
      organizationId_userId_permissionKey: {
        organizationId: orgId,
        userId,
        permissionKey,
      },
    },
  });
  if (!perm) {
    throw new AuthError(
      `Missing permission: ${permissionKey}`,
      403,
      "MISSING_PERMISSION"
    );
  }
}

export async function requireAccountAccess(
  userId: string,
  orgId: string,
  creatorId: string
) {
  // Global-scope roles have implicit access to all accounts
  const member = await prisma.orgMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    select: { role: true },
  });
  if (member && GLOBAL_SCOPE_ROLES.includes(member.role as OrgRoleType)) {
    return;
  }

  // MANAGER: check responsibility table
  if (member?.role === "MANAGER") {
    const responsibility =
      await prisma.managerAccountResponsibility.findUnique({
        where: {
          organizationId_managerId_creatorId: {
            organizationId: orgId,
            managerId: userId,
            creatorId,
          },
        },
      });
    if (responsibility) return;
  }

  // AGENT, VIEWER: check access table
  const access = await prisma.memberAccountAccess.findUnique({
    where: {
      organizationId_userId_creatorId: {
        organizationId: orgId,
        userId,
        creatorId,
      },
    },
  });
  if (!access) {
    throw new AuthError(
      "No access to this creator account",
      403,
      "NO_ACCOUNT_ACCESS"
    );
  }
}

// ─── Delegation Checks ─────────────────────────────────────────────

export function requireDelegationRole(orgRole: OrgRoleType | null) {
  if (!orgRole || !DELEGATION_ROLES.includes(orgRole)) {
    throw new AuthError(
      "Insufficient role for team management",
      403,
      "INSUFFICIENT_DELEGATION_ROLE"
    );
  }
}

export async function requireCanManageAccount(
  actorId: string,
  orgId: string,
  creatorId: string,
  actorRole: OrgRoleType
) {
  if (GLOBAL_SCOPE_ROLES.includes(actorRole)) return;

  if (actorRole === "MANAGER") {
    const responsibility =
      await prisma.managerAccountResponsibility.findUnique({
        where: {
          organizationId_managerId_creatorId: {
            organizationId: orgId,
            managerId: actorId,
            creatorId,
          },
        },
      });
    if (responsibility) return;
    throw new AuthError(
      "Manager scope does not include this account",
      403,
      "MANAGER_SCOPE_EXCEEDED"
    );
  }

  throw new AuthError(
    "Cannot manage accounts with current role",
    403,
    "INSUFFICIENT_ROLE"
  );
}

export async function requireCanManageUser(
  actorId: string,
  orgId: string,
  targetUserId: string,
  actorRole: OrgRoleType
) {
  if (
    actorRole === "OWNER" ||
    actorRole === "ADMIN" ||
    actorRole === "ACCOUNT_EXEC"
  ) {
    return;
  }

  if (actorRole === "MANAGER") {
    const managerAccounts =
      await prisma.managerAccountResponsibility.findMany({
        where: { organizationId: orgId, managerId: actorId },
        select: { creatorId: true },
      });
    const managerCreatorIds = managerAccounts.map((a) => a.creatorId);

    const sharedAccess = await prisma.memberAccountAccess.findFirst({
      where: {
        organizationId: orgId,
        userId: targetUserId,
        creatorId: { in: managerCreatorIds },
      },
    });
    if (sharedAccess) return;

    throw new AuthError(
      "Manager can only manage users within their account scope",
      403,
      "MANAGER_SCOPE_EXCEEDED"
    );
  }

  throw new AuthError(
    "Cannot manage users with current role",
    403,
    "INSUFFICIENT_ROLE"
  );
}

// ─── Scoping Helper ─────────────────────────────────────────────────

export async function getAccessibleCreatorIds(
  userId: string,
  orgId: string,
  orgRole: OrgRoleType
): Promise<string[]> {
  if (GLOBAL_SCOPE_ROLES.includes(orgRole)) {
    const creators = await prisma.creator.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    return creators.map((c) => c.id);
  }

  if (orgRole === "MANAGER") {
    const responsibilities =
      await prisma.managerAccountResponsibility.findMany({
        where: { organizationId: orgId, managerId: userId },
        select: { creatorId: true },
      });
    return responsibilities.map((r) => r.creatorId);
  }

  const accessRows = await prisma.memberAccountAccess.findMany({
    where: { organizationId: orgId, userId },
    select: { creatorId: true },
  });
  return accessRows.map((a) => a.creatorId);
}


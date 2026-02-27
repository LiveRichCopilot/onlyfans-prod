import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth-gateway";

// ─── Permission Keys ────────────────────────────────────────────────

export const ALL_PERMISSIONS = [
  "chat.read",
  "chat.send",
  "chat.mass_send",
  "stats.read",
  "finance.read",
  "payouts.read",
  "payouts.manage",
  "scoring.read",
  "scoring.manage",
  "team_analytics.read",
  "hubstaff.read",
  "hubstaff.screenshots",
  "vault.read",
  "vault.download",
  "vault.upload",
  "tracking_links.read",
  "tracking_links.manage",
  "ai_assist.read",
  "ai_kb.manage",
  "team.manage",
  "team.assign",
  "accounts.connect",
  "modules.manage",
  "billing.manage",
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

// ─── Role Templates ─────────────────────────────────────────────────

export const ROLE_TEMPLATES: Record<
  string,
  { permissions: string[]; accountScope: "all" | "responsible" | "assigned" }
> = {
  owner: {
    permissions: ["*"],
    accountScope: "all",
  },
  admin: {
    permissions: [
      "chat.read", "chat.send", "chat.mass_send",
      "stats.read", "finance.read", "payouts.read",
      "scoring.read", "scoring.manage",
      "team_analytics.read", "hubstaff.read", "hubstaff.screenshots",
      "vault.read", "vault.download", "vault.upload",
      "tracking_links.read", "tracking_links.manage",
      "ai_assist.read", "ai_kb.manage",
      "team.manage", "team.assign", "accounts.connect",
    ],
    accountScope: "all",
  },
  account_executive: {
    permissions: [
      "team.manage", "team.assign", "accounts.connect",
      "stats.read", "chat.read", "chat.send",
      "scoring.read", "team_analytics.read", "hubstaff.read",
    ],
    accountScope: "all",
  },
  manager: {
    permissions: [
      "team.assign", "stats.read", "chat.read", "chat.send",
      "scoring.read", "team_analytics.read",
    ],
    accountScope: "responsible",
  },
  chatter: {
    permissions: ["chat.read", "chat.send"],
    accountScope: "assigned",
  },
  content_specialist: {
    permissions: ["vault.read", "vault.download", "vault.upload"],
    accountScope: "assigned",
  },
  financial_viewer: {
    permissions: ["finance.read", "payouts.read", "stats.read"],
    accountScope: "assigned",
  },
  ai_specialist: {
    permissions: ["ai_kb.manage", "ai_assist.read", "scoring.read"],
    accountScope: "assigned",
  },
  analyst: {
    permissions: ["stats.read", "scoring.read", "team_analytics.read"],
    accountScope: "assigned",
  },
};

// ─── Template Application ───────────────────────────────────────────

export async function applyRoleTemplate(
  orgId: string,
  userId: string,
  templateKey: string
): Promise<void> {
  const template = ROLE_TEMPLATES[templateKey];
  if (!template) {
    throw new AuthError(
      `Unknown role template: ${templateKey}`,
      400,
      "INVALID_TEMPLATE"
    );
  }

  if (template.permissions.includes("*")) return;

  const operations = template.permissions.map((permissionKey) =>
    prisma.memberPermission.upsert({
      where: {
        organizationId_userId_permissionKey: {
          organizationId: orgId,
          userId,
          permissionKey,
        },
      },
      create: { organizationId: orgId, userId, permissionKey },
      update: {},
    })
  );
  await prisma.$transaction(operations);
}

import { prisma } from "@/lib/prisma";

export const MODULE_CATALOG = [
  "chat",
  "stats",
  "scoring",
  "team_analytics",
  "mass_messaging",
  "hubstaff",
  "vault",
  "ai_assist",
  "link_tracking",
  "exports",
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number];

export async function isModuleEnabled(
  orgId: string,
  moduleKey: string
): Promise<boolean> {
  const mod = await prisma.orgModule.findUnique({
    where: {
      organizationId_moduleKey: { organizationId: orgId, moduleKey },
    },
    select: { enabled: true },
  });
  return mod?.enabled ?? false;
}

export async function getEnabledModules(orgId: string): Promise<string[]> {
  const modules = await prisma.orgModule.findMany({
    where: { organizationId: orgId, enabled: true },
    select: { moduleKey: true },
  });
  return modules.map((m) => m.moduleKey);
}

export async function seedAllModules(orgId: string): Promise<void> {
  const operations = MODULE_CATALOG.map((moduleKey) =>
    prisma.orgModule.upsert({
      where: {
        organizationId_moduleKey: { organizationId: orgId, moduleKey },
      },
      create: { organizationId: orgId, moduleKey, enabled: true },
      update: {},
    })
  );
  await prisma.$transaction(operations);
}

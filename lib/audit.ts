import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

interface AuditParams {
  orgId: string;
  userId?: string;
  action: string;
  resource?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

export async function auditLog({
  orgId,
  userId,
  action,
  resource,
  metadata,
  ip,
}: AuditParams): Promise<void> {
  let ipAddress = ip;
  if (!ipAddress) {
    try {
      const hdrs = await headers();
      ipAddress =
        hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        hdrs.get("x-real-ip") ||
        undefined;
    } catch {
      // headers() not available outside request context
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action,
        resource,
        metadata: metadata || undefined,
        ipAddress,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[audit] Failed to write audit log:", error);
  }
}

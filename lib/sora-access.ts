import { prisma } from "@/lib/prisma";
import { requireAuth, type AuthContext } from "@/lib/auth-gateway";

/**
 * Sora tab access — v1.
 *
 * Per Jay (2026-04-06): the whole app is managers-only, so every logged-in
 * user gets full access to the Sora tab. No separate allow list. If you're
 * in, you're in.
 *
 * Uses Supabase Auth via auth-gateway.ts (not NextAuth — that's legacy).
 */

const GLOBAL_SCOPE_ORG_ROLES = new Set(["OWNER", "ADMIN", "ACCOUNT_EXEC"]);

export function isAdmin(ctx: AuthContext): boolean {
  if (ctx.orgRole && GLOBAL_SCOPE_ORG_ROLES.has(ctx.orgRole)) return true;
  if (ctx.email === "jay@liverich.travel" || ctx.email === "david@liverich.travel") return true;
  return false;
}

export type SoraModel = {
  id: string;
  name: string;
  ofUsername: string | null;
  avatarUrl: string | null;
};

/**
 * Everyone in the app sees every active model on the Sora tab.
 * (The app itself is gated to managers by the middleware login.)
 */
export async function listAllModels(): Promise<SoraModel[]> {
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

/**
 * Returns the current AuthContext, or null if not logged in.
 * Never throws — pages/routes can branch on null.
 */
export async function getSoraAuthSafe(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

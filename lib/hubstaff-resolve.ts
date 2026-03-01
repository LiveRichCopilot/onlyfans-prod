import { prisma } from "@/lib/prisma";
import { listMembers } from "@/lib/hubstaff";

/**
 * Resolve a chatter email to a Hubstaff user ID.
 *
 * 1. Check HubstaffUserMapping table (fast, cached)
 * 2. If not found, pull all Hubstaff members and auto-match by email or name
 * 3. If matched, create the mapping automatically so future lookups are instant
 *
 * Returns { hubstaffUserId, hubstaffName } or null if no match.
 */
export async function resolveHubstaffUser(
  chatterEmail: string,
  creatorId?: string | null,
): Promise<{ hubstaffUserId: number; hubstaffName: string } | null> {
  // Step 1: Check existing mapping
  const existing = await prisma.hubstaffUserMapping.findFirst({
    where: { chatterEmail: chatterEmail },
  });

  if (existing) {
    return {
      hubstaffUserId: parseInt(existing.hubstaffUserId),
      hubstaffName: existing.hubstaffName || "",
    };
  }

  // Step 2: Pull Hubstaff members and try to auto-match
  try {
    const { members, users } = await listMembers();

    // Build user lookup (members have user_id, users have id/name/email)
    const userMap = new Map<number, { name: string; email: string }>();
    for (const u of users) {
      userMap.set(u.id, { name: u.name || "", email: u.email || "" });
    }

    // Try exact email match first
    const emailNorm = chatterEmail.toLowerCase().trim();
    let matchedUserId: number | null = null;
    let matchedName = "";

    for (const m of members) {
      const user = userMap.get(m.user_id);
      if (!user) continue;

      if (user.email.toLowerCase().trim() === emailNorm) {
        matchedUserId = m.user_id;
        matchedName = user.name;
        break;
      }
    }

    // If no email match, try name match
    if (!matchedUserId) {
      // Get chatter name from profile or email prefix
      const profile = await prisma.chatterProfile.findFirst({
        where: { chatterEmail: chatterEmail },
        select: { chatterName: true },
      });
      const chatterName = (profile?.chatterName || chatterEmail.split("@")[0]).toLowerCase().trim();

      for (const m of members) {
        const user = userMap.get(m.user_id);
        if (!user) continue;
        const hsName = user.name.toLowerCase().trim();

        // Exact name match or strong partial match
        if (hsName === chatterName) {
          matchedUserId = m.user_id;
          matchedName = user.name;
          break;
        }

        // Check if all parts of one name appear in the other
        const hsParts = hsName.split(/\s+/);
        const chParts = chatterName.split(/\s+/);
        const hsInCh = hsParts.every(p => chatterName.includes(p));
        const chInHs = chParts.every(p => hsName.includes(p));
        if ((hsInCh || chInHs) && hsParts.length >= 2) {
          matchedUserId = m.user_id;
          matchedName = user.name;
          break;
        }
      }
    }

    if (!matchedUserId) return null;

    // Step 3: Auto-create mapping for future lookups
    const resolvedCreatorId = creatorId || await getDefaultCreatorId(chatterEmail);
    if (resolvedCreatorId) {
      try {
        await prisma.hubstaffUserMapping.create({
          data: {
            hubstaffUserId: String(matchedUserId),
            hubstaffName: matchedName,
            chatterEmail: chatterEmail,
            creatorId: resolvedCreatorId,
          },
        });
        console.log(`[hubstaff-resolve] Auto-mapped ${chatterEmail} → Hubstaff user ${matchedUserId} (${matchedName})`);
      } catch (e: any) {
        // Might fail on unique constraint if concurrent requests — that's fine
        if (!e.message?.includes("Unique constraint")) {
          console.error("[hubstaff-resolve] Failed to create mapping:", e.message);
        }
      }
    }

    return { hubstaffUserId: matchedUserId, hubstaffName: matchedName };
  } catch (e: any) {
    console.error("[hubstaff-resolve] Hubstaff API error during auto-match:", e.message);
    return null;
  }
}

/** Get a default creator ID for a chatter (from their most recent session or profile) */
async function getDefaultCreatorId(email: string): Promise<string | null> {
  const session = await prisma.chatterSession.findFirst({
    where: { email },
    orderBy: { clockIn: "desc" },
    select: { creatorId: true },
  });
  if (session) return session.creatorId;

  const profile = await prisma.chatterProfile.findFirst({
    where: { chatterEmail: email },
    select: { creatorId: true },
  });
  return profile?.creatorId || null;
}

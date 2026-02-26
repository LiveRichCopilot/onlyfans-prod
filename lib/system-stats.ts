import { prisma } from "@/lib/prisma";

export async function getSystemStats() {
  const [
    totalFans,
    totalTransactions,
    connectedCreators,
    aiClassifications,
    intentEvents,
    fanFacts,
    // table counts
    userCount,
    sessionCount,
    accountCount,
    creatorAssignmentCount,
    mediaAssetCount,
    fanPreferenceCount,
    fanLifecycleEventCount,
    chatQAReviewCount,
    verificationTokenCount,
  ] = await Promise.all([
    prisma.fan.count(),
    prisma.transaction.count(),
    prisma.creator.count({ where: { active: true } }),
    prisma.fanLifecycleEvent.count({ where: { type: "ai_classification" } }),
    prisma.fanIntentEvent.count(),
    prisma.fanFact.count(),
    // tables
    prisma.user.count(),
    prisma.session.count(),
    prisma.account.count(),
    prisma.creatorAssignment.count(),
    prisma.mediaAsset.count(),
    prisma.fanPreference.count(),
    prisma.fanLifecycleEvent.count(),
    prisma.chatQAReview.count(),
    prisma.verificationToken.count(),
  ]);

  return {
    totalFans,
    totalTransactions,
    connectedCreators,
    aiClassifications,
    intentEvents,
    fanFacts,
    tables: [
      { name: "Creator", purpose: "Connected OF accounts", count: connectedCreators },
      { name: "Fan", purpose: "Individual fan profiles + 55 intelligence fields", count: totalFans },
      { name: "Transaction", purpose: "Tips, PPV, subs, messages", count: totalTransactions },
      { name: "FanFact", purpose: "Structured long-term memory per fan", count: fanFacts },
      { name: "FanIntentEvent", purpose: "Buying intent signals from messages", count: intentEvents },
      { name: "FanPreference", purpose: "Content/format preference tags", count: fanPreferenceCount },
      { name: "FanLifecycleEvent", purpose: "Stage changes, milestones, follow-ups", count: fanLifecycleEventCount },
      { name: "ChatQAReview", purpose: "Chatter quality-assurance scores", count: chatQAReviewCount },
      { name: "MediaAsset", purpose: "Vault content metadata", count: mediaAssetCount },
      { name: "User", purpose: "Auth accounts (agency/cfo/employee)", count: userCount },
      { name: "CreatorAssignment", purpose: "Team-member to creator scoping", count: creatorAssignmentCount },
      { name: "Session", purpose: "Active login sessions", count: sessionCount },
      { name: "Account", purpose: "OAuth provider links", count: accountCount },
      { name: "VerificationToken", purpose: "Email verification tokens", count: verificationTokenCount },
    ],
  };
}

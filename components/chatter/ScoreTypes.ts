/**
 * Shared types, config, and utility functions for chatter scoring UI.
 */

export interface ScoreEntry {
  email: string;
  chatterName: string | null;
  creatorName: string;
  creatorId: string;
  clockIn: string | null;
  isLive: boolean;
  currentScore: {
    totalScore: number;
    slaScore: number;
    followupScore: number;
    triggerScore: number;
    qualityScore: number;
    revenueScore: number;
    copyPastePenalty: number;
    missedTriggerPenalty: number;
    spamPenalty: number;
    detectedArchetype: string | null;
    windowStart: string;
    windowEnd: string;
    messagesAnalyzed: number;
    conversationsScanned: number;
    robotPhraseCount: number;
    aiNotes: string | null;
    notableQuotes: Array<{
      text: string;
      type: "great" | "good" | "bad" | "ugly";
      context: string;
    }> | null;
    mistakeTags: string[];
    strengthTags: string[];
  } | null;
  profile: {
    avgTotalScore: number;
    avgSlaScore: number;
    avgFollowupScore: number;
    avgTriggerScore: number;
    avgQualityScore: number;
    avgRevenueScore: number;
    dominantArchetype: string | null;
    recentScores: number[] | null;
    improvementIndex: number;
    totalScoringSessions: number;
    topStrengths: string[];
    topWeaknesses: string[];
  } | null;
}

export const ARCHETYPE_CONFIG: Record<string, { label: string; color: string }> = {
  chameleon: { label: "Chameleon", color: "text-emerald-400" },
  sweetheart: { label: "Sweetheart", color: "text-pink-400" },
  aggressor: { label: "Aggressor", color: "text-orange-400" },
  tease: { label: "Tease", color: "text-purple-400" },
  yes_babe_robot: { label: "Yes Babe Robot", color: "text-red-500" },
  interview_bot: { label: "Interview Bot", color: "text-yellow-400" },
  doormat: { label: "Doormat", color: "text-red-400" },
  fact_bot: { label: "Fact Bot", color: "text-yellow-500" },
  friend_zone: { label: "Friend Zone", color: "text-blue-400" },
  vending_machine: { label: "Vending Machine", color: "text-gray-400" },
};

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/15 border-emerald-500/25";
  if (score >= 50) return "bg-yellow-500/15 border-yellow-500/25";
  return "bg-red-500/15 border-red-500/25";
}

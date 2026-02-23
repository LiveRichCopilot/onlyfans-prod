/**
 * Fan Intelligence computation library.
 * Pure functions for scoring, classifying, and recommending actions for fans.
 * No external dependencies.
 */

export type FanData = {
  lifetimeSpend: number;
  lastPurchaseAt: Date | null;
  lastMessageAt: Date | null;
  stage: string | null;
  intentScore: number | null;
  avgOrderValue: number | null;
  timeWasterScore: number | null;
  buyerType: string | null;
};

/**
 * Compute a 0-100 time waster score.
 * High score = lots of messages with low conversions.
 *
 * - Base = days since last purchase * 3 (capped at 60)
 * - Subtract spend factor: lifetimeSpend / 20
 * - Bonus penalty if messaging recently but last purchase is old
 * - Clamped to 0-100
 */
export function computeTimeWasterScore(fan: FanData): number {
  const now = new Date();

  // Days since last purchase (default to 90 if never purchased)
  const daysSinceLastPurchase = fan.lastPurchaseAt
    ? (now.getTime() - fan.lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24)
    : 90;

  // Base score from purchase recency
  const base = Math.min(daysSinceLastPurchase * 3, 60);

  // Spend factor lowers the score
  const spendFactor = fan.lifetimeSpend / 20;

  // Bonus penalty: messaging recently but not buying
  let bonusPenalty = 0;
  if (fan.lastMessageAt) {
    const daysSinceLastMessage =
      (now.getTime() - fan.lastMessageAt.getTime()) / (1000 * 60 * 60 * 24);
    // Chatting within last 7 days but no purchase in 30+ days
    if (daysSinceLastMessage < 7 && daysSinceLastPurchase > 30) {
      bonusPenalty = 20;
    }
  }

  const score = base - spendFactor + bonusPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Compute PPV conversion rate as a 0-1 ratio.
 * Returns 0 if no PPVs have been sent.
 */
export function computeConversionRate(
  ppvSent: number,
  ppvBought: number
): number {
  if (!ppvSent || ppvSent <= 0) return 0;
  return Math.max(0, Math.min(1, (ppvBought ?? 0) / ppvSent));
}

/**
 * Detect the top 3-4 active hours (0-23) from message timestamps.
 * Returns an empty array if fewer than 5 messages are provided.
 */
export function detectActiveHours(messageTimestamps: Date[]): number[] {
  if (!messageTimestamps || messageTimestamps.length < 5) return [];

  // Count messages per hour bucket
  const hourCounts = new Map<number, number>();
  for (const ts of messageTimestamps) {
    const hour = ts.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  // Sort by frequency descending, take top 4
  return Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([hour]) => hour);
}

/**
 * Compute the next best action and reason for a fan based on their stage,
 * intent score, average order value, and time waster score.
 */
export function computeNextBestAction(fan: FanData): {
  action: string;
  reason: string;
} {
  // Time waster override takes precedence
  const twScore =
    fan.timeWasterScore ?? computeTimeWasterScore(fan);
  if (twScore > 70) {
    return {
      action: "deprioritize",
      reason: "High message count, low conversions",
    };
  }

  switch (fan.stage) {
    case "new":
      return {
        action: "build_rapport",
        reason: "New subscriber — establish connection first",
      };

    case "warming":
      if ((fan.intentScore ?? 0) > 50) {
        return {
          action: "offer_bundle",
          reason: "Warming up with buying intent — strike now",
        };
      }
      return {
        action: "build_rapport",
        reason: "Still warming — keep building trust",
      };

    case "active_buyer":
      if ((fan.avgOrderValue ?? 0) > 50) {
        return {
          action: "upsell",
          reason: "Active high spender — offer premium content",
        };
      }
      return {
        action: "maintain",
        reason: "Active buyer — keep engagement consistent",
      };

    case "cooling_off":
      return {
        action: "set_followup",
        reason: "Going cold — schedule a personal check-in",
      };

    case "at_risk":
      return {
        action: "win_back",
        reason: "At risk of churning — send exclusive offer",
      };

    case "churned":
      return {
        action: "deprioritize",
        reason: "Churned — low priority unless reactivation campaign",
      };

    case "reactivated":
      return {
        action: "offer_bundle",
        reason: "Came back — reward with a special deal",
      };

    default:
      return {
        action: "build_rapport",
        reason: "Unknown stage — default to rapport building",
      };
  }
}

/**
 * Determine buyer type from a 30-day transaction type breakdown.
 * Input: `{ tip: 5, message: 2, subscription: 1, custom: 0 }` etc.
 */
export function computeBuyerType(txCounts: Record<string, number>): string {
  // Check for custom buyer first (presence of custom transactions)
  if ((txCounts["custom"] ?? 0) > 0) return "custom_buyer";

  const total = Object.values(txCounts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return "window_shopper";

  const tips = txCounts["tip"] ?? 0;
  const messages = txCounts["message"] ?? 0;
  const subscriptions = txCounts["subscription"] ?? 0;

  // "Mostly" = that type is the plurality
  if (tips > 0 && tips >= messages && tips >= subscriptions) return "tipper";
  if (messages > 0 && messages >= tips && messages >= subscriptions)
    return "ppv_buyer";
  if (subscriptions > 0 && subscriptions === total) return "subscriber_only";

  return "window_shopper";
}

/**
 * Categorize a fan by lifetime spend into a price range.
 */
export function computePriceRange(lifetimeSpend: number): string {
  if (lifetimeSpend >= 200) return "whale";
  if (lifetimeSpend >= 50) return "high";
  if (lifetimeSpend >= 10) return "mid";
  if (lifetimeSpend > 0) return "low";
  return "none";
}

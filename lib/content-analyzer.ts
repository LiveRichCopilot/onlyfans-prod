// Hook categories for message classification
// "question" — asks fan something ("rate me", "choose A or B", "what do you think")
// "teaser" — curiosity hook ("guess what", "you won't believe", "I have something")
// "personal" — intimate/targeted ("I was thinking about you", "made this just for you")
// "urgency" — scarcity/FOMO ("only today", "limited time", "before I delete")
// "direct_offer" — straight PPV/sale ("unlock this", "new content for you")
// "casual" — check-in/warmup ("hey babe", "miss you", "how's your day")
// "game" — interactive ("truth or dare", "would you rather", "play a game")
// "flirty" — sexual tension building ("I'm so bored", "wish you were here")

export type HookCategory =
  | "question"
  | "teaser"
  | "personal"
  | "urgency"
  | "direct_offer"
  | "casual"
  | "game"
  | "flirty"
  | "other";

export type MessageFeatures = {
  hookCategory: HookCategory;
  hookText: string; // first 12 words
  hasQuestion: boolean;
  hasMedia: boolean;
  isPPV: boolean;
  priceBucket: string; // "free" | "$1-10" | "$10-25" | "$25-50" | "$50+"
  textLength: "short" | "medium" | "long"; // <20 chars, 20-100, 100+
};

// Rule-based fast classifier (no AI needed for basic hook detection):
export function classifyHook(
  rawText: string,
  mediaCount: number,
  price: number,
  isFree: boolean
): MessageFeatures {
  const clean = (rawText || "").replace(/<[^>]+>/g, "").trim();
  const lower = clean.toLowerCase();
  const words = clean.split(/\s+/);
  const hookText = words.slice(0, 12).join(" ");
  const hasQuestion = lower.includes("?");

  // Determine hook category by keyword patterns
  let hookCategory: HookCategory = "other";

  if (/\b(rate|choose|pick|which|would you rather|what do you|poll|vote)\b/i.test(lower)) {
    hookCategory = "question";
  } else if (/\b(guess what|you won'?t believe|surprise|something special|wait till|secret)\b/i.test(lower)) {
    hookCategory = "teaser";
  } else if (/\b(thinking about you|just for you|made this|reminded me of you|dreaming about)\b/i.test(lower)) {
    hookCategory = "personal";
  } else if (/\b(only today|limited|before i delete|hurry|last chance|expir|don'?t miss)\b/i.test(lower)) {
    hookCategory = "urgency";
  } else if (/\b(unlock|new content|check your|sent you|ppv|exclusive drop)\b/i.test(lower)) {
    hookCategory = "direct_offer";
  } else if (/\b(truth or dare|would you rather|play a game|let'?s play|game time)\b/i.test(lower)) {
    hookCategory = "game";
  } else if (/\b(miss you|hey babe|how'?s your|good morning|what'?s up|checking in)\b/i.test(lower)) {
    hookCategory = "casual";
  } else if (/\b(bored|wish you|thinking naughty|can'?t stop|turned on|so horny|wet)\b/i.test(lower)) {
    hookCategory = "flirty";
  } else if (hasQuestion) {
    hookCategory = "question";
  }

  // Price bucket
  let priceBucket = "free";
  if (price > 50) priceBucket = "$50+";
  else if (price > 25) priceBucket = "$25-50";
  else if (price > 10) priceBucket = "$10-25";
  else if (price > 0) priceBucket = "$1-10";

  // Text length
  let textLength: "short" | "medium" | "long" = "short";
  if (clean.length > 100) textLength = "long";
  else if (clean.length > 20) textLength = "medium";

  return {
    hookCategory,
    hookText,
    hasQuestion,
    hasMedia: mediaCount > 0,
    isPPV: !isFree && price > 0,
    priceBucket,
    textLength,
  };
}

// For the content type label
export function getContentType(
  mediaCount: number,
  price: number,
  isFree: boolean
): string {
  if (price > 0 && !isFree) return "PPV";
  if (mediaCount > 0) return "Media";
  return "Text Only";
}

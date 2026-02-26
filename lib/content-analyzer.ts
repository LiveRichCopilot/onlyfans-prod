// Hook categories for message classification
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

export type MediaType = "photo" | "video" | "audio" | "text-only";

export type MessageFeatures = {
  hookCategory: HookCategory;
  hookText: string; // first 12 words
  hasQuestion: boolean;
  hasMedia: boolean;
  hasCTA: boolean;
  isPPV: boolean;
  priceBucket: string;
  textLength: "short" | "medium" | "long";
  mediaType: MediaType;
};

// CTA detection patterns
const CTA_PATTERNS = /\b(unlock|open|click|tap|check|see|watch|view|buy|get|grab|claim|subscribe|tip|send|dm me|reply|respond|answer|vote|choose|pick)\b/i;

// Rule-based fast classifier (no AI needed for basic hook detection):
export function classifyHook(
  rawText: string,
  mediaCount: number,
  price: number,
  isFree: boolean,
  mediaTypes?: string[]
): MessageFeatures {
  const clean = (rawText || "").replace(/<[^>]+>/g, "").trim();
  const lower = clean.toLowerCase();
  const words = clean.split(/\s+/);
  const hookText = words.slice(0, 12).join(" ");
  const hasQuestion = lower.includes("?");
  const hasCTA = CTA_PATTERNS.test(lower);

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

  let priceBucket = "free";
  if (price > 50) priceBucket = "$50+";
  else if (price > 25) priceBucket = "$25-50";
  else if (price > 10) priceBucket = "$10-25";
  else if (price > 0) priceBucket = "$1-10";

  let textLength: "short" | "medium" | "long" = "short";
  if (clean.length > 100) textLength = "long";
  else if (clean.length > 20) textLength = "medium";

  // Determine media type from media array types
  let mediaType: MediaType = "text-only";
  if (mediaTypes && mediaTypes.length > 0) {
    if (mediaTypes.some(t => t === "video" || t === "gif")) mediaType = "video";
    else if (mediaTypes.some(t => t === "audio")) mediaType = "audio";
    else if (mediaTypes.some(t => t === "photo")) mediaType = "photo";
  } else if (mediaCount > 0) {
    mediaType = "photo"; // fallback if we have count but no types
  }

  return {
    hookCategory,
    hookText,
    hasQuestion,
    hasMedia: mediaCount > 0,
    hasCTA,
    isPPV: !isFree && price > 0,
    priceBucket,
    textLength,
    mediaType,
  };
}

// Detailed content type label
export function getContentType(
  mediaCount: number,
  price: number,
  isFree: boolean,
  mediaType?: MediaType
): string {
  if (price > 0 && !isFree) {
    if (mediaType === "video") return "PPV Video";
    if (mediaType === "audio") return "PPV Audio";
    if (mediaType === "photo") return "PPV Photo";
    return "PPV";
  }
  if (mediaType === "video") return "Free Video";
  if (mediaType === "audio") return "Free Audio";
  if (mediaCount > 0) return "Free Photo";
  return "Text Only";
}

// Extract thumbnail URL from OFAPI media object
export function extractThumb(media: Record<string, unknown>): string {
  const m = media as Record<string, any>;
  return (
    m.files?.thumb?.url ||
    m.files?.squarePreview?.url ||
    m.files?.preview?.url ||
    m.thumb ||
    m.squarePreview ||
    m.preview ||
    m.files?.full?.url ||
    m.src ||
    ""
  );
}

// Extract media type from OFAPI media object
export function extractMediaType(media: Record<string, unknown>): string {
  const m = media as Record<string, any>;
  return m.type || "photo";
}

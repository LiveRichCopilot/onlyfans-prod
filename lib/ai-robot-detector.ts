/**
 * Robot Phrase Detector (v1 — keyword matching, no AI)
 *
 * Detects generic/robotic phrases that make conversations feel canned.
 * Used by the performance scoring system to penalize lazy chatting.
 */

const ROBOT_PHRASES = [
    "yes babe",
    "aww thanks",
    "sounds good",
    "that's so sweet",
    "thanks babe",
    "love that",
    "omg really",
    "haha yes",
    "that's hot",
    "you're so sweet",
    "thanks hun",
    "lol thanks",
    "aw babe",
    "you're the best",
    "miss you too",
    "love you too",
    "hey babe",
    "hi babe",
    "good morning babe",
    "good night babe",
    "xo",
    "xoxo",
    "muah",
    "😘😘😘",
];

// Creative indicators — phrases that show actual engagement
const CREATIVE_INDICATORS = [
    // Questions that show interest
    /\?/,
    // Personalized references (names, specific details)
    /\b(remember|told me|you said|last time)\b/i,
    // Emotional engagement
    /\b(honestly|actually|really want|can't stop|thinking about)\b/i,
    // Future building
    /\b(imagine|picture this|what if|between us|just for you|special)\b/i,
    // Push-pull tactics
    /\b(maybe|might|if you're good|earn it|deserve|patience)\b/i,
    // CTAs and urgency
    /\b(limited|only|tonight|right now|before|don't miss)\b/i,
];

export type RobotDetectorResult = {
    robotCount: number;
    creativeCount: number;
    robotExamples: string[];
    creativeExamples: string[];
};

/**
 * Analyze an array of creator messages for robot phrases vs creative writing.
 */
export function detectRobotPhrases(creatorMessages: string[]): RobotDetectorResult {
    const robotExamples: string[] = [];
    const creativeExamples: string[] = [];
    let robotCount = 0;
    let creativeCount = 0;

    for (const msg of creatorMessages) {
        const lower = msg.toLowerCase().trim();

        // Check for robot phrases
        const isRobot = ROBOT_PHRASES.some(
            (phrase) => lower === phrase || lower.startsWith(phrase + " ") || lower.endsWith(" " + phrase),
        );

        if (isRobot) {
            robotCount++;
            if (robotExamples.length < 5) robotExamples.push(msg.slice(0, 60));
            continue;
        }

        // Check for creative indicators
        const creativeMatches = CREATIVE_INDICATORS.filter((pattern) => pattern.test(msg));
        if (creativeMatches.length >= 2 || (msg.length > 40 && creativeMatches.length >= 1)) {
            creativeCount++;
            if (creativeExamples.length < 3) creativeExamples.push(msg.slice(0, 80));
        }
    }

    return { robotCount, creativeCount, robotExamples, creativeExamples };
}

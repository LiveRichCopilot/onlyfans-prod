/**
 * Dynamic Elastic Pricing Engine
 *
 * Pure math, no AI. Suggests optimal PPV price based on:
 * - Base price (set by chatter)
 * - Heat multiplier (Strike Zone: green/yellow/red)
 * - Spend tier multiplier (whale/high/mid/low)
 *
 * Formula: base_price * heat_multiplier * spend_tier_multiplier
 */

const HEAT_MULTIPLIERS: Record<string, number> = {
    green: 1.5,   // High intent — they'll pay more
    yellow: 1.2,  // Moderate — slight premium
    red: 1.0,     // Cold — don't push price
};

const SPEND_TIER_MULTIPLIERS: Record<string, number> = {
    whale: 1.5,   // $200+ lifetime — price accordingly
    high: 1.3,    // $50-199 — can stretch
    mid: 1.0,     // $10-49 — standard
    low: 0.8,     // $1-9 — discount to convert
    none: 0.7,    // $0 — deep discount to get first purchase
};

export type PriceSuggestion = {
    suggestedPrice: number;
    basePrice: number;
    heatMultiplier: number;
    spendMultiplier: number;
    reasoning: string;
};

/**
 * Calculate suggested PPV price.
 */
export function suggestPrice(params: {
    basePrice: number;
    strikeZone: "green" | "yellow" | "red";
    priceRange: string | null;    // whale, high, mid, low, none
    avgOrderValue: number | null; // Historical average spend
}): PriceSuggestion {
    const { basePrice, strikeZone, priceRange, avgOrderValue } = params;

    const heatMult = HEAT_MULTIPLIERS[strikeZone] || 1.0;
    const spendMult = SPEND_TIER_MULTIPLIERS[priceRange || "mid"] || 1.0;

    let suggested = Math.round(basePrice * heatMult * spendMult);

    // Cap: never suggest more than 3x base or less than 0.5x
    suggested = Math.max(Math.round(basePrice * 0.5), Math.min(suggested, basePrice * 3));

    // If we know their avg order value, don't go too far above it
    if (avgOrderValue && suggested > avgOrderValue * 2) {
        suggested = Math.round(avgOrderValue * 1.5);
    }

    // Round to nice numbers
    if (suggested > 10) {
        suggested = Math.round(suggested / 5) * 5; // Round to nearest $5
    }

    const reasoning = `${strikeZone === "green" ? "Hot buyer" : strikeZone === "yellow" ? "Warming up" : "Cold"} + ${priceRange || "unknown"} spender = ${heatMult}x heat × ${spendMult}x tier`;

    return {
        suggestedPrice: suggested,
        basePrice,
        heatMultiplier: heatMult,
        spendMultiplier: spendMult,
        reasoning,
    };
}

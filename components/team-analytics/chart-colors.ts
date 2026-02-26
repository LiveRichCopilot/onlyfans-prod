export const CHART_COLORS = {
  teal: "#2DD4BF",
  purple: "#A78BFA",
  blue: "#60A5FA",
  amber: "#FBBF24",
  pink: "#F472B6",
  emerald: "#34D399",
  red: "#F87171",
  cyan: "#22D3EE",
  indigo: "#818CF8",
  orange: "#FB923C",
} as const;

export const COLOR_ARRAY = Object.values(CHART_COLORS);

export function getColor(index: number): string {
  return COLOR_ARRAY[index % COLOR_ARRAY.length];
}

export function scoreColor(score: number): string {
  if (score >= 80) return CHART_COLORS.emerald;
  if (score >= 60) return CHART_COLORS.teal;
  if (score >= 40) return CHART_COLORS.amber;
  return CHART_COLORS.red;
}

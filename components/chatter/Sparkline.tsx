/**
 * Sparkline — Tiny SVG trend line for recent scores.
 */

export function Sparkline({ scores }: { scores: number[] }) {
  if (!scores || scores.length < 2) return null;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * width;
      const y = height - ((s - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = scores[scores.length - 1] - scores[0];
  const strokeColor =
    trend > 5
      ? "stroke-emerald-400"
      : trend < -5
        ? "stroke-red-400"
        : "stroke-white/30";

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        className={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

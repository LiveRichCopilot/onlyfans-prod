import type { ThemeRow } from "@/lib/lucy-insights";

export function ThemeGrid({ themes }: { themes: ThemeRow[] }) {
  if (themes.length === 0) {
    return (
      <p className="body" style={{ marginTop: "1rem" }}>
        Not enough mentions yet to rank content themes.
      </p>
    );
  }

  return (
    <div
      style={{
        marginTop: "1.5rem",
        display: "grid",
        gap: "0.25rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      }}
    >
      {themes.map((t, i) => (
        <div
          key={t.key}
          style={{
            padding: "1rem 1rem 1rem 0",
            borderTop: i > 0 ? "1px solid var(--line)" : "none",
          }}
        >
          <h3 style={{ fontSize: "1.125rem" }}>{t.label}</h3>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.85rem",
              color: "var(--ink-mute)",
            }}
          >
            {t.fanMentions.toLocaleString()} fans mentioned this ·{" "}
            {t.salesAfter.toLocaleString()} bought after bringing it up
          </div>
        </div>
      ))}
    </div>
  );
}

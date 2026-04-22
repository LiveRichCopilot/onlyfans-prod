import type { ThemeRow } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

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
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "0.75rem",
            }}
          >
            <h3 style={{ fontSize: "1.125rem" }}>{t.label}</h3>
            <span className="num-small" style={{ color: "var(--accent)" }}>
              {fmtUSD(t.revenue)}
            </span>
          </div>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.85rem",
              color: "var(--ink-mute)",
            }}
          >
            {t.fanMentions.toLocaleString()} fan mentions ·{" "}
            {t.salesLeadUps.toLocaleString()} sales after mention
          </div>
          <div className="body" style={{ fontSize: "0.88rem", marginTop: "0.25rem" }}>
            {t.description}
          </div>
        </div>
      ))}
    </div>
  );
}

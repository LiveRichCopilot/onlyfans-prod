import type { Win } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const SOURCE_LABEL: Record<string, string> = {
  Employee: "Chatter-driven",
  System: "Mass message",
  Creator: "Creator message",
};

export function WinCard({ win }: { win: Win }) {
  const sourceLabel = SOURCE_LABEL[win.source] || win.source;

  return (
    <details style={{ padding: "0.5rem 0" }}>
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "1rem 0",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <span
              className="num-small"
              style={{ color: "var(--accent)", fontSize: "1.75rem" }}
            >
              {fmtUSD(win.amount)}
            </span>
            <span style={{ color: "var(--ink-mute)", fontSize: "0.85rem" }}>
              PPV unlock
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "0.15rem 0.6rem",
                borderRadius: 999,
                border: "1px solid var(--line-strong)",
                color: "var(--ink-dim)",
              }}
            >
              {sourceLabel}
            </span>
          </div>
          <div
            style={{
              marginTop: "0.25rem",
              color: "var(--ink-mute)",
              fontSize: "0.82rem",
            }}
          >
            Fan #{win.fanNumber} · {win.date}
          </div>
        </div>
        <span
          style={{
            color: "var(--ink-mute)",
            fontSize: "0.8rem",
            border: "1px solid var(--line-strong)",
            borderRadius: 999,
            padding: "0.15rem 0.75rem",
          }}
        >
          View conversation
        </span>
      </summary>

      <div
        style={{
          padding: "1rem 0 1.5rem 0",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {win.messages.length === 0 && (
          <div
            className="body"
            style={{ color: "var(--ink-mute)", fontSize: "0.85rem" }}
          >
            No preceding messages captured.
          </div>
        )}
        {win.messages.map((m, i) => {
          const isLucy = m.fromCreator;
          const hasPrice = (m.price ?? 0) > 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: isLucy ? "flex-end" : "flex-start",
              }}
            >
              <div style={{ maxWidth: "82%" }}>
                <div className={isLucy ? "bubble-creator" : "bubble-fan"}>
                  {m.text || (
                    <span style={{ fontStyle: "italic", color: "var(--ink-mute)" }}>
                      [media attachment]
                    </span>
                  )}
                  {hasPrice && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span className="chip">PPV {fmtUSD(m.price!)}</span>
                    </div>
                  )}
                </div>
                <div
                  className="meta"
                  style={{
                    textAlign: isLucy ? "right" : "left",
                  }}
                >
                  {isLucy ? "Lucy" : `Fan #${win.fanNumber}`} · {m.time}
                </div>
              </div>
            </div>
          );
        })}

        <div className="sale-marker" role="status" aria-label="Purchase">
          <span className="sale-dot" />
          <span>Fan purchased</span>
          <span className="sale-amount">{fmtUSD(win.amount)}</span>
          <span>{sourceLabel}</span>
          <span className="sale-dot" />
        </div>
      </div>
    </details>
  );
}

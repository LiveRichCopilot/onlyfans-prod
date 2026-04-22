import type { Win } from "@/lib/lucy-insights";

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const TYPE_LABELS: Record<string, string> = {
  tip: "Tip",
  message: "PPV message",
  post: "Post purchase",
  stream: "Stream",
  subscription: "Subscription",
  referral: "Referral",
  unknown: "Sale",
};

export function WinCard({ win }: { win: Win }) {
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
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
            <span
              className="num-small"
              style={{ color: "var(--accent)", fontSize: "1.75rem" }}
            >
              {fmtUSD(win.amount)}
            </span>
            <span style={{ color: "var(--ink-mute)", fontSize: "0.85rem" }}>
              {TYPE_LABELS[win.type] || win.type}
            </span>
          </div>
          <div
            style={{
              marginTop: "0.25rem",
              color: "var(--ink-mute)",
              fontSize: "0.82rem",
            }}
          >
            Fan #{win.fanNumber} · {fmtDateTime(win.date)}
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
          const isLucy = m.isFromCreator;
          const hasPPV = m.price > 0;
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
                  {hasPPV && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span className="chip">PPV {fmtUSD(m.price)}</span>
                    </div>
                  )}
                  {m.isTip && m.tipAmount > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span className="chip">Tip {fmtUSD(m.tipAmount)}</span>
                    </div>
                  )}
                </div>
                <div
                  className="meta"
                  style={{
                    textAlign: isLucy ? "right" : "left",
                  }}
                >
                  {isLucy ? "Lucy" : `Fan #${win.fanNumber}`} · {fmtTime(m.sentAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

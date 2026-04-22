import type { Win, WinMessage } from "@/lib/lucy-insights";

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

function Bubble({ m, fanNumber }: { m: WinMessage; fanNumber: number }) {
  const isLucy = m.fromCreator;
  const hasPrice = (m.price ?? 0) > 0;
  const isSold = m.soldHere === true;
  const isAfter = m.stage === "after";
  const bubbleClass = isLucy
    ? `bubble-creator${isSold ? " sold" : ""}${isAfter && !isSold ? " bubble-after" : ""}`
    : `bubble-fan${isAfter ? " bubble-after" : ""}`;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isLucy ? "flex-end" : "flex-start",
      }}
    >
      <div style={{ maxWidth: "82%" }}>
        <div className={bubbleClass}>
          {m.text || (
            <span style={{ fontStyle: "italic", color: "var(--ink-mute)" }}>
              [media attachment]
            </span>
          )}
          {hasPrice && (
            <div style={{ marginTop: "0.5rem" }}>
              <span className="chip">
                {isSold ? "Sold · " : "PPV "}
                {fmtUSD(m.price!)}
              </span>
            </div>
          )}
        </div>
        <div
          className="meta"
          style={{ textAlign: isLucy ? "right" : "left" }}
        >
          {isLucy ? "Lucy" : `Fan #${fanNumber}`} &middot; {m.time}
        </div>
      </div>
    </div>
  );
}

export function WinCard({ win }: { win: Win }) {
  const sourceLabel = SOURCE_LABEL[win.source] || win.source;
  const multiBuy = (win.additionalBuys ?? 0) > 0;
  const windowRev = win.windowRevenue ?? win.amount;

  const before = win.messages.filter((m) => m.stage === "before");
  const sale = win.messages.filter((m) => m.stage === "sale");
  const after = win.messages.filter((m) => m.stage === "after");
  const legacy = win.messages.filter((m) => !m.stage);

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
            {multiBuy && (
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "0.15rem 0.6rem",
                  borderRadius: 999,
                  border: "1px solid rgba(74, 222, 128, 0.4)",
                  color: "#bbf7d0",
                  background: "rgba(74, 222, 128, 0.1)",
                }}
              >
                +{win.additionalBuys} more buys &middot; {fmtUSD(windowRev)} total
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: "0.25rem",
              color: "var(--ink-mute)",
              fontSize: "0.82rem",
            }}
          >
            Fan #{win.fanNumber} &middot; {win.date}
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
        {multiBuy && (
          <div className="multi-buy-banner">
            This fan bought <strong>{fmtUSD(windowRev)}</strong> across{" "}
            <strong>{(win.additionalBuys ?? 0) + 1}</strong> purchases in this conversation
            window &mdash; the bot learns the warm-up that unlocked the first buy and what
            kept them spending.
          </div>
        )}

        {legacy.map((m, i) => (
          <Bubble key={`l-${i}`} m={m} fanNumber={win.fanNumber} />
        ))}

        {before.length > 0 && (
          <div className="stage-divider">Lead-up &mdash; what got them warm</div>
        )}
        {before.map((m, i) => (
          <Bubble key={`b-${i}`} m={m} fanNumber={win.fanNumber} />
        ))}

        {sale.map((m, i) => (
          <Bubble key={`s-${i}`} m={m} fanNumber={win.fanNumber} />
        ))}

        <div className="sale-marker" role="status" aria-label="Purchase">
          <span className="sale-dot" />
          <span>Fan purchased</span>
          <span className="sale-amount">{fmtUSD(win.amount)}</span>
          <span>{sourceLabel}</span>
          <span className="sale-dot" />
        </div>

        {after.length > 0 && (
          <div className="stage-divider">
            What happened next &mdash; fan reaction &amp; any follow-up buys
          </div>
        )}
        {after.map((m, i) => (
          <Bubble key={`a-${i}`} m={m} fanNumber={win.fanNumber} />
        ))}
      </div>
    </details>
  );
}

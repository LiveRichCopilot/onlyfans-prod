import type { VoiceFingerprint as VoiceData } from "@/lib/lucy-insights";

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num-display" style={{ marginTop: "0.35rem" }}>
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: "0.25rem",
            color: "var(--ink-mute)",
            fontSize: "0.85rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export function VoiceFingerprint({ voice }: { voice: VoiceData }) {
  return (
    <section className="section">
      <hr className="rule" />
      <div style={{ marginTop: "2rem" }}>
        <div className="eyebrow">Your voice</div>
        <h2 style={{ marginTop: "0.5rem" }}>How you actually write</h2>
        <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
          This is the fingerprint the chatbot copies so it sounds like you, not a stock
          script. Pulled from {voice.totalMessages.toLocaleString()} of your December
          messages.
        </p>
      </div>

      <div
        style={{
          marginTop: "2rem",
          display: "grid",
          gap: "2rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <StatBlock
          label="Avg length"
          value={`${Math.round(voice.avgCharLength)}`}
          sub={`characters · ${voice.avgWordLength.toFixed(1)} words`}
        />
        <StatBlock
          label="Lowercase-only"
          value={`${voice.lowercaseOnlyPct.toFixed(0)}%`}
          sub="of your messages"
        />
        <StatBlock
          label="Trailing dots..."
          value={`${voice.trailingDotsPct.toFixed(0)}%`}
          sub="your rhythm tick"
        />
        <StatBlock
          label="Emotion markers"
          value={`${voice.emojiMessagesPct.toFixed(0)}%`}
          sub="of messages"
        />
      </div>

      <div
        style={{
          marginTop: "3rem",
          display: "grid",
          gap: "2.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.25rem" }}>How you open</h3>
          <div style={{ marginTop: "1rem" }}>
            {voice.openers.slice(0, 8).map((o, i) => (
              <div
                key={i}
                style={{
                  padding: "0.6rem 0",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span className="body" style={{ flex: 1 }}>
                  &ldquo;{o.text}&rdquo;
                </span>
                <span style={{ color: "var(--ink-mute)", fontSize: "0.78rem" }}>
                  &times;{o.count}
                </span>
              </div>
            ))}
            {voice.openers.length === 0 && (
              <div className="body" style={{ color: "var(--ink-mute)" }}>
                No repeating openers yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "1.25rem" }}>How you sign off</h3>
          <div style={{ marginTop: "1rem" }}>
            {voice.signOffs.slice(0, 8).map((o, i) => (
              <div
                key={i}
                style={{
                  padding: "0.6rem 0",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span className="body" style={{ flex: 1 }}>
                  &ldquo;{o.text}&rdquo;
                </span>
                <span style={{ color: "var(--ink-mute)", fontSize: "0.78rem" }}>
                  &times;{o.count}
                </span>
              </div>
            ))}
            {voice.signOffs.length === 0 && (
              <div className="body" style={{ color: "var(--ink-mute)" }}>
                No repeating sign-offs yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

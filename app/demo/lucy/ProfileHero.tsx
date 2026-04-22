export function ProfileHero({
  name,
  username,
  avatarUrl,
  headerUrl,
  messageCount,
  saleCount,
  dateRangeLabel,
}: {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  messageCount: number;
  saleCount: number;
  dateRangeLabel: string;
}) {
  const displayName = name || username || "Creator";
  const handle = username ? `@${username}` : null;

  return (
    <header>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4/1",
          maxHeight: 240,
          overflow: "hidden",
          borderRadius: 12,
        }}
      >
        {headerUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={headerUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="eager"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #2b2926, #111110)",
            }}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "1.25rem",
          marginTop: "-3rem",
          position: "relative",
          zIndex: 2,
          paddingLeft: "1.25rem",
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            border: "4px solid var(--bg)",
            overflow: "hidden",
            background: "var(--paper)",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="eager"
            />
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <div className="eyebrow">Sales DNA brief · private</div>
        <h1 style={{ marginTop: "0.5rem" }}>{displayName}</h1>
        {handle && (
          <div style={{ color: "var(--ink-mute)", fontSize: "1rem", marginTop: "0.25rem" }}>
            {handle}
          </div>
        )}
        <p className="lead" style={{ marginTop: "1.25rem", maxWidth: "58ch" }}>
          Welcome back. This page pulls together everything we talked about in our meeting — in
          your words — and shows you the chatbot we&rsquo;re building for you. Built from{" "}
          <strong style={{ color: "var(--ink)" }}>
            {messageCount.toLocaleString()}
          </strong>{" "}
          of your messages and{" "}
          <strong style={{ color: "var(--ink)" }}>
            {saleCount.toLocaleString()}
          </strong>{" "}
          sales ({dateRangeLabel}).
        </p>
      </div>
    </header>
  );
}

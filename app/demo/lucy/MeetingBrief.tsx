export function MeetingBrief() {
  return (
    <section className="section">
      <hr className="rule" />
      <div style={{ marginTop: "2rem" }}>
        <div className="eyebrow">The meeting</div>
        <h2 style={{ marginTop: "0.5rem" }}>In your own words</h2>
        <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
          You came back after a break. Here&rsquo;s what you said you want, and the things
          you said need to change — pulled straight from the recording.
        </p>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <blockquote>
          I want to be more organized and intentional with what&rsquo;s going out, even if
          it means in the short term we&rsquo;re making less money.
          <span className="quote-attr">Lucy · meeting</span>
        </blockquote>
        <blockquote>
          I&rsquo;m not super pressed about it right now because I&rsquo;d rather start it
          right.
          <span className="quote-attr">Lucy · meeting</span>
        </blockquote>
      </div>

      <div
        style={{
          marginTop: "2.5rem",
          display: "grid",
          gap: "2.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div>
          <h3>What you want to change</h3>
          <ul className="body" style={{ marginTop: "0.75rem", paddingLeft: "1.2rem" }}>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Your brand.</strong> Go more personal, more
              &ldquo;you&rdquo; — not generic.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>The vault.</strong> Clear categories, clean
              labels, delete the tier-1-to-tier-5 clutter that nobody could make sense of.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Drip sets.</strong> Each set gets its own
              list. Fans who&rsquo;ve seen any part of it never see a repeat — the whole
              live-and-naughty illusion breaks otherwise.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Sale hygiene.</strong> Chatters never sell
              from &ldquo;All media&rdquo; again. Only from curated folders — nothing that
              could be a custom, a drip, or something you didn&rsquo;t want out.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Conversation flow.</strong> Start fans
              from your oldest content and walk them forward — tell the story — instead of
              opening with the newest set.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Customs backlog.</strong> One live
              marathon to clear what&rsquo;s owed, then custom pricing goes up. No more
              $5–10 customs for a porn star.
            </li>
            <li>
              <strong style={{ color: "var(--ink)" }}>Chatter training.</strong> Quality
              assurance on every huddle, so the person we interviewed is the one actually on
              your account.
            </li>
          </ul>
        </div>

        <div>
          <h3>Your to-do list, in order</h3>
          <ol
            className="body"
            style={{
              marginTop: "0.75rem",
              paddingLeft: "1.4rem",
              counterReset: "step",
              listStyleType: "decimal",
            }}
          >
            <li style={{ marginBottom: "0.5rem" }}>Organize everything — vault, folders, sheets.</li>
            <li style={{ marginBottom: "0.5rem" }}>Start writing scripts.</li>
            <li style={{ marginBottom: "0.5rem" }}>Add your personal assistant.</li>
            <li style={{ marginBottom: "0.5rem" }}>Debrief the assistant fully.</li>
            <li style={{ marginBottom: "0.5rem" }}>Clean up the Google sheets.</li>
            <li style={{ marginBottom: "0.5rem" }}>Upload the new content that&rsquo;s sitting.</li>
            <li>Create AI content (using the Chinese model tools we talked about).</li>
          </ol>

          <div style={{ marginTop: "2rem" }}>
            <h3>Your revenue floor</h3>
            <div className="body" style={{ marginTop: "0.5rem" }}>
              <span className="num-small">$9,000</span>
              <span style={{ color: "var(--ink-mute)", marginLeft: "0.5rem" }}>per day minimum</span>
              <div style={{ marginTop: "0.25rem" }}>
                <span style={{ color: "var(--accent)", fontFamily: "var(--font-serif)", fontSize: "1.5rem" }}>
                  $14,000
                </span>
                <span style={{ color: "var(--ink-mute)", marginLeft: "0.5rem" }}>per day target</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "2.5rem" }}>
        <h3>How the vault should be organized</h3>
        <p className="body" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          The structure you described in the meeting — every individual video is its own
          script, and every themed bundle is its own script too.
        </p>
        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <div className="eyebrow">Top categories</div>
            <div className="body" style={{ marginTop: "0.5rem" }}>
              boy / girl · girl / girl · boy / boy / girl · DP
            </div>
          </div>
          <div>
            <div className="eyebrow">Sub-categories</div>
            <div className="body" style={{ marginTop: "0.5rem" }}>
              breeding · bondage · anal · anal creampie · BBC
            </div>
          </div>
          <div>
            <div className="eyebrow">Bundles</div>
            <div className="body" style={{ marginTop: "0.5rem" }}>
              college girl · squirting · holidays
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { notFound } from "next/navigation";
import { buildLucyReport } from "@/lib/lucy-insights";
import { ProfileHero } from "./ProfileHero";
import { MeetingBrief } from "./MeetingBrief";
import { VoiceFingerprint } from "./VoiceFingerprint";
import { ThemeGrid } from "./ThemeGrid";
import { WinCard } from "./WinCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const REVENUE_LABEL: Record<string, string> = {
  tip: "Tips",
  message: "PPV messages",
  post: "Post purchases",
  subscription: "Subscriptions",
  other: "Other",
};

export default async function LucyDemoPage() {
  const report = await buildLucyReport();
  if (!report) notFound();

  const { creator, window: winLabel, revenue, themes, wins, voice } = report;
  const firstName =
    (creator.name || creator.username || "Lucy")
      .split(" ")[0]
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim() || "Lucy";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem 1.25rem 6rem",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <ProfileHero
          name={creator.name}
          username={creator.username}
          avatarUrl={creator.avatarUrl}
          headerUrl={creator.headerUrl}
          messageCount={voice.totalMessages}
          saleCount={revenue.count}
          dateRangeLabel={winLabel}
        />

        <MeetingBrief />

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">December 2025 &middot; your strongest recent month</div>
            <h2 style={{ marginTop: "0.5rem" }}>How the money came in</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Real December numbers from your OnlyFans statement. This is the baseline we
              want back.
            </p>
          </div>

          <div
            style={{
              marginTop: "2rem",
              padding: "1.5rem 0 1rem",
              borderTop: "1px solid var(--line-strong)",
              borderBottom: "1px solid var(--line-strong)",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="eyebrow">December total (gross)</div>
              <div className="num-display" style={{ marginTop: "0.4rem" }}>
                {fmtUSD(revenue.total)}
              </div>
            </div>
            <div
              style={{
                color: "var(--ink-mute)",
                fontSize: "0.85rem",
                textAlign: "right",
              }}
            >
              {revenue.count.toLocaleString()} paid transactions
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            {revenue.byType.map((r, i) => (
              <div
                key={r.type}
                style={{
                  padding: "1rem 0",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "baseline",
                  gap: "1rem",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.15rem" }}>
                    {REVENUE_LABEL[r.type] || r.type}
                  </h3>
                  <div
                    style={{
                      marginTop: "0.35rem",
                      color: "var(--ink-mute)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {r.count.toLocaleString()} transactions ·{" "}
                    {((r.revenue / revenue.total) * 100).toFixed(0)}% of revenue
                  </div>
                </div>
                <span className="num-small" style={{ color: "var(--accent)" }}>
                  {fmtUSD(r.revenue)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">What your fans talk about</div>
            <h2 style={{ marginTop: "0.5rem" }}>Before they buy</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Content themes fans brought up in your December chats. Ranked by how often
              a purchase followed &mdash; so you see which topics move the needle.
            </p>
          </div>
          <ThemeGrid themes={themes} />
        </section>

        <VoiceFingerprint voice={voice} />

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">Winning conversations</div>
            <h2 style={{ marginTop: "0.5rem" }}>How {firstName} closes</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Your top {wins.length} December PPV unlocks, each with the messages that led
              into it. Tagged as mass-message vs chatter-driven. The green bar marks the
              moment the fan paid.
            </p>
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            {wins.map((w, i) => (
              <WinCard key={i} win={w} />
            ))}
            {wins.length === 0 && (
              <p className="body" style={{ marginTop: "1rem" }}>
                No sales captured in this window.
              </p>
            )}
          </div>
        </section>

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">Roadmap</div>
            <h2 style={{ marginTop: "0.5rem" }}>How your chatbot keeps improving</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Everything above is the v1 training set. Here&rsquo;s what we add as you
              keep shipping content and your managers clean up the vault.
            </p>
          </div>

          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gap: "1.5rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {[
              {
                h: "Learn every new winning conversation",
                b: "When a chatter closes a good sale, that exact lead-up gets added to the bot's script library automatically — not hand-written theory.",
              },
              {
                h: "Know which set every fan has seen",
                b: "The bot tracks drip-set exposure per fan, so it never sends a repeat mid-set and breaks the live illusion.",
              },
              {
                h: "Match fan archetypes to content themes",
                b: "Anal fans, squirt fans, custom-seekers — the bot learns which theme each fan responds to and steers toward that.",
              },
              {
                h: "Follow your rules, not generic scripts",
                b: "Never sell from All Media. Start from oldest content. Obvious tag names. The bot enforces these before suggesting a send.",
              },
              {
                h: "Stay in your voice",
                b: "Your cadence (lowercase, trailing dots, emotion markers) stays locked. The bot never sounds like a generic chatter.",
              },
              {
                h: "Raise custom floor pricing",
                b: "The bot refuses to quote customs under your minimum. No more $5–10 customs for a porn star.",
              },
              {
                h: "Escalate whales, not spam them",
                b: "When a fan shows whale signal, the bot flags for a human closer and varies pricing instead of spamming $100 three times.",
              },
              {
                h: "Flag chatter misbehavior",
                b: "Every response is scored against your rules. If someone&rsquo;s going off-brand or selling from the wrong folder, you see it in the dashboard.",
              },
            ].map((item, i) => (
              <div key={i}>
                <h3 style={{ fontSize: "1.125rem" }}>{item.h}</h3>
                <p className="body" style={{ marginTop: "0.5rem" }}>
                  {item.b}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer
          style={{
            marginTop: "5rem",
            paddingTop: "2rem",
            borderTop: "1px solid var(--line)",
            color: "var(--ink-mute)",
            fontSize: "0.82rem",
            lineHeight: 1.6,
          }}
        >
          Private document &middot; revenue from your December OnlyFans statement &middot;
          message patterns from 39,761 of your December messages &middot; fans shown
          anonymously as &ldquo;Fan #N&rdquo;.
        </footer>
      </div>
    </main>
  );
}

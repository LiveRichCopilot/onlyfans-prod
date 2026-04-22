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
            <div className="eyebrow">What you can feed the bot</div>
            <h2 style={{ marginTop: "0.5rem" }}>To make it actually sound like you</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Chatters and managers run the day-to-day. These are the specific things{" "}
              <em>you</em> can give us that nobody else can &mdash; and that turn a generic
              bot into a chatbot that texts like Lucy Mochi.
            </p>
          </div>

          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gap: "2rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {[
              {
                h: "Voice memos, transcribed",
                b: "Talk into your phone like you&rsquo;re texting a fan. 2–5 minute riffs on whatever &mdash; how you flirt, how you tease, how you react to compliments, how you say &ldquo;babe&rdquo; vs &ldquo;hun&rdquo;. We transcribe, the bot learns the cadence nobody else has.",
              },
              {
                h: "Your personality sheet",
                b: "What you like, what you don&rsquo;t, what makes you laugh, what turns you off, your backstory, your humor style. One voice memo answering a list of questions is all we need. The bot stops defaulting to generic chatter energy.",
              },
              {
                h: "Story-worthy memories",
                b: "Anecdotes about your trips, your shoots, your wild nights, the weird fan interactions. Fans spend more on creators who feel real &mdash; these are the personal details the bot works into dry conversations to warm them back up.",
              },
              {
                h: "Rules of engagement",
                b: "What you&rsquo;ll never say, never promise, never sell. What words you hate (&ldquo;gift&rdquo;? &ldquo;honey&rdquo;?). Hard no&rsquo;s on content. We bake these in so the bot never embarrasses you.",
              },
              {
                h: "A weekly 5-minute vibe check",
                b: "Listen to 3 bot-drafted messages, tell us which one sounds like you and which one doesn&rsquo;t. That correction loop is what keeps the bot aligned over time &mdash; takes you 5 min a week.",
              },
              {
                h: "Your backstage context",
                b: "When you&rsquo;re traveling, doing a shoot, sick, offline &mdash; a quick voice note so the bot can tell fans &ldquo;she&rsquo;s in Berlin this week&rdquo; instead of sounding scripted.",
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

          <div style={{ marginTop: "3.5rem" }}>
            <div className="eyebrow">On our side</div>
            <h3 style={{ marginTop: "0.4rem", fontSize: "1.5rem" }}>
              What the bot + managers handle
            </h3>
            <p className="body" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
              Nothing in this list needs your time &mdash; your managers and the bot own
              these.
            </p>
            <div
              style={{
                marginTop: "1.5rem",
                display: "grid",
                gap: "1.25rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              }}
            >
              {[
                {
                  h: "Learns every new winning conversation",
                  b: "When a chatter closes a good sale, that exact lead-up gets added to the script library automatically.",
                },
                {
                  h: "Knows which set every fan has seen",
                  b: "Tracks drip-set exposure per fan so no fan ever sees a repeat mid-set.",
                },
                {
                  h: "Matches fan archetypes to themes",
                  b: "Anal fans, squirt fans, custom-seekers &mdash; learns what each fan responds to and steers toward it.",
                },
                {
                  h: "Enforces your rules",
                  b: "Never sells from All Media. Obvious tag names. Starts fans from oldest content first.",
                },
                {
                  h: "Guards custom floor pricing",
                  b: "Refuses to quote customs under your minimum. No more $5&ndash;10 customs.",
                },
                {
                  h: "Escalates whales, doesn&rsquo;t spam them",
                  b: "Flags whale signal for a human closer. Varies pricing instead of $100 / $100 / $100.",
                },
                {
                  h: "Flags chatter misbehavior",
                  b: "Every response is scored against your rules. Off-brand activity shows up in the manager dashboard.",
                },
                {
                  h: "Stays in your voice",
                  b: "Cadence (lowercase, trailing dots, emotion markers) stays locked &mdash; never sounds generic.",
                },
              ].map((item, i) => (
                <div key={i}>
                  <h3 style={{ fontSize: "1.05rem" }}>{item.h}</h3>
                  <p
                    className="body"
                    style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}
                  >
                    {item.b}
                  </p>
                </div>
              ))}
            </div>
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

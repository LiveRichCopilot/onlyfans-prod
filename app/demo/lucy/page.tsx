import { notFound } from "next/navigation";
import { buildLucyReport } from "@/lib/lucy-insights";
import { ProfileHero } from "./ProfileHero";
import { MeetingBrief } from "./MeetingBrief";
import { VoiceFingerprint } from "./VoiceFingerprint";
import { ThemeGrid } from "./ThemeGrid";
import { WinCard } from "./WinCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const SALE_TYPE_LABEL: Record<string, string> = {
  tip: "Tips",
  message: "PPV messages",
  post: "Post purchases",
  stream: "Stream",
  subscription: "Subscriptions",
  referral: "Referral",
  unknown: "Other",
};

export default async function LucyDemoPage() {
  const report = await buildLucyReport();
  if (!report) notFound();

  const { creator, stats, saleTypes, themes, wins, voice } = report;
  const firstName = (creator.name || creator.username || "Lucy")
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
          saleCount={stats.saleCount}
          dateRangeLabel={`${fmtDate(stats.dateStart)} – ${fmtDate(stats.dateEnd)}`}
        />

        <MeetingBrief />

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">The chatbot</div>
            <h2 style={{ marginTop: "0.5rem" }}>What it&rsquo;s learning from</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Every section below is evidence. We read your real messages, your real sales,
              and the conversations fans had with you right before they bought. The bot
              learns from patterns that already worked on your page — no generic scripts,
              no guesses.
            </p>
          </div>
        </section>

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">What your fans talk about</div>
            <h2 style={{ marginTop: "0.5rem" }}>Before they buy</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Content themes fans mentioned in your chats. Ranked by revenue that
              followed — so you see what actually moves money, not just what gets talked
              about.
            </p>
          </div>
          <ThemeGrid themes={themes} />
        </section>

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">How the money comes in</div>
            <h2 style={{ marginTop: "0.5rem" }}>Your revenue split</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Broken out like your OnlyFans statements page, so it matches what you see
              on your side.
            </p>
          </div>
          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gap: "0.25rem",
            }}
          >
            {saleTypes.map((r, i) => (
              <div
                key={r.type}
                style={{
                  padding: "1.1rem 0",
                  borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "baseline",
                  gap: "1rem",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.2rem" }}>
                    {SALE_TYPE_LABEL[r.type] || r.type}
                  </h3>
                  <div
                    style={{
                      marginTop: "0.4rem",
                      color: "var(--ink-mute)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {r.count.toLocaleString()} sales · {r.pctOfRevenue.toFixed(0)}% of revenue
                  </div>
                </div>
                <span className="num-small" style={{ color: "var(--accent)" }}>
                  {fmtUSD(r.revenue)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <VoiceFingerprint voice={voice} />

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">Winning conversations</div>
            <h2 style={{ marginTop: "0.5rem" }}>How {firstName} closes</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              The last {wins.length} sales, each with the 15 messages that led into it. This
              is the script library — real sequences the bot learns from. Tap any row to
              see the conversation.
            </p>
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            {wins.map((w, i) => (
              <WinCard key={i} win={w} />
            ))}
            {wins.length === 0 && (
              <p className="body" style={{ marginTop: "1rem" }}>
                No sales captured in the current data window.
              </p>
            )}
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
          Private document · reads live from our database · fans shown anonymously as
          &ldquo;Fan #N&rdquo; · no contact info, no OF user IDs.
        </footer>
      </div>
    </main>
  );
}

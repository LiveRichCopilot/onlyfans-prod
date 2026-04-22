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

export default async function LucyDemoPage() {
  const report = await buildLucyReport();
  if (!report) notFound();

  const { creator, stats, themes, wins, voice } = report;
  const topWins = [...wins].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const firstName =
    (creator.name || creator.username || "Lucy")
      .split(" ")[0]
      .replace(/\p{Extended_Pictographic}/gu, "")
      .trim() || "Lucy";
  const windowLabel = `${fmtDate(stats.dateStart)} – ${fmtDate(stats.dateEnd)}`;

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
          dateRangeLabel={windowLabel}
        />

        <MeetingBrief />

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">The chatbot</div>
            <h2 style={{ marginTop: "0.5rem" }}>What it&rsquo;s learning from</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Every section below is evidence from your real account. The bot learns from
              patterns that already worked on your page &mdash; no generic scripts, no
              guesses.
            </p>
          </div>
        </section>

        <section className="section">
          <hr className="rule" />
          <div style={{ marginTop: "2rem" }}>
            <div className="eyebrow">What your fans talk about</div>
            <h2 style={{ marginTop: "0.5rem" }}>Before they buy</h2>
            <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
              Content themes fans mentioned in your chats. Ranked by how often a sale
              followed &mdash; so you see which topics actually move the needle.
            </p>
            <p
              className="body"
              style={{
                marginTop: "0.5rem",
                fontSize: "0.82rem",
                color: "var(--ink-mute)",
              }}
            >
              Current window: {windowLabel}. Once we pull your December history, the
              pattern will reflect a full strong month.
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
              Top {topWins.length} sales in the current window, each with the 15 messages
              that led into it. Tap any row to see the conversation &mdash; the green bar
              marks the moment the fan paid.
            </p>
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            {topWins.map((w, i) => (
              <WinCard key={i} win={w} />
            ))}
            {topWins.length === 0 && (
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
          Private document &middot; reads live from our database &middot; fans shown
          anonymously as &ldquo;Fan #N&rdquo; &middot; no contact info, no OF user IDs.
        </footer>
      </div>
    </main>
  );
}

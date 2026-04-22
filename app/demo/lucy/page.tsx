import { notFound } from "next/navigation";
import { buildLucyReport } from "@/lib/lucy-insights";
import { StatsGrid } from "./StatsGrid";
import { VoiceFingerprint } from "./VoiceFingerprint";
import { PhraseList } from "./PhraseList";
import { SaleBreakdown } from "./SaleBreakdown";
import { WinCard } from "./WinCard";
import { MeetingBrief } from "./MeetingBrief";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCESS_TOKEN = "lucy-dna-x7k92q";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default async function LucyDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  if (k !== ACCESS_TOKEN) notFound();

  const report = await buildLucyReport();
  if (!report) notFound();

  const { creator, stats, fanPhrases, lucyPhrases, saleTypes, wins, voice } = report;
  const displayName = creator.name || creator.username || "Lucy";

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 sm:py-12">
      <div className="mx-auto max-w-[680px]">
        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-widest text-teal-300/80 font-medium">
            Sales DNA · Private draft
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-tight">
            {displayName}&rsquo;s chatbot brief
          </h1>
          <p className="mt-3 text-[15px] text-white/60 leading-relaxed">
            What fans actually say before they buy, how {displayName} closes, and the voice a bot
            would need to copy. Built from{" "}
            <span className="text-white">{voice.totalMessages.toLocaleString()}</span> of her
            messages and{" "}
            <span className="text-white">{stats.saleCount.toLocaleString()}</span> sales of $25+
            ({fmtDate(stats.dateStart)} – {fmtDate(stats.dateEnd)}).
          </p>
        </header>

        <MeetingBrief />

        <section className="mt-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            What&rsquo;s already in the data
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Pulled live from her messages and sales. Everything below is real — no sample data.
          </p>
          <div className="mt-4">
            <StatsGrid stats={stats} />
          </div>
        </section>

        <VoiceFingerprint voice={voice} />

        <PhraseList
          title="What fans say before they buy"
          subtitle="Ranked by average revenue per phrase (min 2 occurrences)"
          rows={fanPhrases}
          emptyLabel="Not enough repeating fan phrases yet."
        />

        <PhraseList
          title={`How ${displayName} closes`}
          subtitle="Her actual lines that preceded a sale, ranked by average revenue"
          rows={lucyPhrases}
          emptyLabel="Not enough repeating closing phrases yet."
        />

        <SaleBreakdown rows={saleTypes} />

        <section className="mt-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Real wins</h2>
          <p className="mt-1 text-sm text-white/50">
            The last {wins.length} sales of $25+, each with the 15 messages that led up to it. Tap
            to expand.
          </p>
          <div className="mt-4 space-y-3">
            {wins.map((w, i) => (
              <WinCard key={i} win={w} />
            ))}
            {wins.length === 0 && (
              <div className="glass-card rounded-2xl p-5 text-sm text-white/50">
                No sales ≥ $25 found yet.
              </div>
            )}
          </div>
        </section>

        <footer className="mt-12 mb-8 text-xs text-white/40 leading-relaxed">
          Reads live from our database. No new tracking — all of this was already being stored.
          Share this URL verbally with the access token. Fans are shown as &ldquo;Fan #N&rdquo; —
          no usernames, no IDs.
        </footer>
      </div>
    </main>
  );
}

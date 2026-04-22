import { notFound } from "next/navigation";
import { buildLucyReport } from "@/lib/lucy-insights";
import { StatsGrid } from "./StatsGrid";
import { VoiceFingerprint } from "./VoiceFingerprint";
import { PhraseList } from "./PhraseList";
import { SaleBreakdown } from "./SaleBreakdown";
import { WinCard } from "./WinCard";
import { MeetingBrief } from "./MeetingBrief";
import { ProfileHero } from "./ProfileHero";
import { BarChart3, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default async function LucyDemoPage() {
  const report = await buildLucyReport();
  if (!report) notFound();

  const { creator, stats, fanPhrases, lucyPhrases, saleTypes, wins, voice } = report;
  const displayName = creator.name || creator.username || "Lucy";
  const firstName = (displayName.split(" ")[0] || "Lucy").replace(
    /\p{Extended_Pictographic}/gu,
    "",
  );

  return (
    <main className="min-h-screen px-4 sm:px-6 py-8 sm:py-12">
      <div className="mx-auto max-w-[680px]">
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

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-teal-300/80" />
            <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              What&rsquo;s already in the data
            </h2>
          </div>
          <p className="mt-1 text-sm text-white/50">
            Pulled live from her messages and sales. Everything below is real &mdash; no sample
            data. Window: Nov 1, 2025 onward.
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
          title={`How ${firstName} closes`}
          subtitle="Her actual lines that preceded a sale, ranked by average revenue"
          rows={lucyPhrases}
          emptyLabel="Not enough repeating closing phrases yet."
        />

        <SaleBreakdown rows={saleTypes} />

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-teal-300/80" />
            <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Real wins</h2>
          </div>
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

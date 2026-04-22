import { ClipboardList, FolderTree, Check, Ban, Megaphone, Target } from "lucide-react";

export function MeetingBrief() {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-teal-300/80" />
        <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
          The brief from Lucy
        </h2>
      </div>
      <p className="mt-1 text-sm text-white/50">
        Straight from the meeting &mdash; her words, her plan, her to-do list
      </p>

      <div className="mt-4 glass-prominent rounded-2xl p-5 sm:p-6">
        <div className="text-[11px] uppercase tracking-widest text-teal-300/80 font-medium">
          Her north star
        </div>
        <p className="mt-2 text-[17px] sm:text-[18px] text-white leading-relaxed">
          &ldquo;I want to be more organized and intentional with what&rsquo;s going out, even if
          it means in the short term we&rsquo;re making less money.&rdquo;
        </p>
        <p className="mt-3 text-[15px] text-white/70 leading-relaxed">
          &ldquo;I&rsquo;m not super pressed about it right now because I&rsquo;d rather start it
          right.&rdquo;
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-white/50">
            <Check size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wider font-medium">
              Her to-do list (next few days)
            </span>
          </div>
          <ol className="mt-3 space-y-2 text-[15px] text-white/90">
            {[
              "Organize everything — vault, folders, sheets",
              "Start writing scripts",
              "Add her personal assistant",
              "Debrief the assistant fully",
              "Clean up the Google sheets",
              "Upload the new content that's sitting",
              "Create AI content (using the Chinese model tools)",
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-teal-400 shrink-0 font-mono text-xs mt-1">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-white/50">
            <FolderTree size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wider font-medium">
              How her vault gets organized
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-[15px] text-white/90 leading-snug">
            <li>
              <span className="text-white">Top-level categories</span>
              <span className="text-white/60"> — boy/girl, girl/girl, boy/boy/girl, DP</span>
            </li>
            <li>
              <span className="text-white">Sub-categories</span>
              <span className="text-white/60"> — breeding, bondage, anal, anal creampie, BBC</span>
            </li>
            <li>
              <span className="text-white">Bundles</span>
              <span className="text-white/60"> — college girl, squirting, holidays</span>
            </li>
            <li>
              <span className="text-white">Every individual video</span>
              <span className="text-white/60"> = its own script. Every bundle = a script.</span>
            </li>
            <li>
              <span className="text-white">Drip sets</span>
              <span className="text-white/60"> — tagged with daytime / nighttime / BTS labels</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-3 glass-card rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-white/50">
          <Check size={12} className="shrink-0" />
          <span className="text-[11px] uppercase tracking-wider font-medium">
            Rules chatters must follow
          </span>
        </div>
        <ul className="mt-3 space-y-2.5 text-[15px] text-white/90 leading-snug">
          {[
            <>
              <span className="text-white">Never</span> sell from &ldquo;All media&rdquo;. Only
              from curated folders &mdash; anything else could be a custom, a drip set, or content
              she doesn&rsquo;t want going out.
            </>,
            <>
              Every drip set gets its <span className="text-white">own list</span>. As soon as a
              fan sees <em>any</em> part, tick the list. If they see a repeat photo they
              &ldquo;saw her send live,&rdquo; the whole illusion breaks.
            </>,
            <>
              Tags must be <span className="text-white">obvious</span> (&ldquo;Gigi&rdquo;
              &mdash; not &ldquo;GGvids&rdquo;). Chatters only check one place; they won&rsquo;t
              dig.
            </>,
            <>
              Start fans from the <span className="text-white">oldest content first</span>.
              &ldquo;Let me take you on my journey&rdquo; &mdash; then walk forward. Don&rsquo;t
              always open with the newest.
            </>,
            <>
              When a sale happens from a great lead-up, that conversation{" "}
              <span className="text-white">gets added to the script library</span>. Real winning
              sequences, not theory.
            </>,
          ].map((content, i) => (
            <li key={i} className="flex gap-2.5">
              <Check size={14} className="text-teal-400 shrink-0 mt-1" />
              <span>{content}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-rose-300/70">
            <Ban size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wider font-medium">
              Kill these anti-patterns
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-white/85 leading-snug">
            {[
              "Spamming a whale with $100, $100, $100 — no price variation, no personalization",
              "Hitting a cold fan with flat pricing after a natural wave — it ends the wave",
              "Sending a fan a photo they’ve already seen mid-drip-set",
              "Unlabeled audio clips the chatters can’t find",
              "Old tier-1-to-tier-5 clutter nobody can make sense of",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <Ban size={12} className="text-rose-300/60 shrink-0 mt-1.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-white/50">
            <Megaphone size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wider font-medium">
              What Jay&rsquo;s running on the growth side
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-white/85 leading-snug">
            {[
              "Instagram + TikTok ads (walking / reaction clips while Lucy’s in town)",
              "Podcast booking support — PR girl handles adult podcast list",
              "Photo shoots + BTS lives during her May stay",
              "Possible Asia-side AI video channel using Lucy’s China bank account",
              "AI chatbot training — the goal is replacing most chatters over time",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <Check size={12} className="text-teal-400/70 shrink-0 mt-1.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 glass-inset rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-white/50">
          <Target size={12} className="shrink-0" />
          <span className="text-[11px] uppercase tracking-wider font-medium">
            Revenue target set in the meeting
          </span>
        </div>
        <p className="mt-2 text-[15px] text-white/90 leading-relaxed">
          Floor:{" "}
          <span className="text-white font-semibold">no lower than $9,000/day</span> — $8K is the
          absolute low. Target run-rate:{" "}
          <span className="text-teal-300 font-semibold">$14,000/day</span>. Customs backlog to be
          cleared in one 2-day live marathon.
        </p>
      </div>
    </section>
  );
}

export function MeetingBrief() {
  return (
    <section className="mt-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
        The brief from Lucy
      </h2>
      <p className="mt-1 text-sm text-white/50">
        Straight from the meeting — her words, her plan, her to-do list
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
          <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
            Her to-do list (next few days)
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
          <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
            How her vault gets organized
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
        <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
          Rules chatters must follow
        </div>
        <ul className="mt-3 space-y-2.5 text-[15px] text-white/90 leading-snug">
          <li className="flex gap-2.5">
            <span className="text-teal-400 shrink-0 mt-1">→</span>
            <span>
              <span className="text-white">Never</span> sell from &ldquo;All media&rdquo;. Only from
              curated folders — anything else could be a custom, a drip set, or content she
              doesn&rsquo;t want going out.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-teal-400 shrink-0 mt-1">→</span>
            <span>
              Every drip set gets its <span className="text-white">own list</span>. As soon as a
              fan sees <em>any</em> part, tick the list. If they see a repeat photo they
              &ldquo;saw her send live,&rdquo; the whole illusion breaks.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-teal-400 shrink-0 mt-1">→</span>
            <span>
              Tags must be <span className="text-white">obvious</span> (&ldquo;Gigi&rdquo; — not
              &ldquo;GGvids&rdquo;). Chatters only check one place; they won&rsquo;t dig.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-teal-400 shrink-0 mt-1">→</span>
            <span>
              Start fans from the <span className="text-white">oldest content first</span>.
              &ldquo;Let me take you on my journey&rdquo; — then walk forward. Don&rsquo;t always
              open with the newest.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-teal-400 shrink-0 mt-1">→</span>
            <span>
              When a sale happens from a great lead-up, that conversation{" "}
              <span className="text-white">gets added to the script library</span>. Real winning
              sequences, not theory.
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-rose-300/70 font-medium">
            Kill these anti-patterns
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-white/85 leading-snug">
            <li>Spamming a whale with $100, $100, $100 — no price variation, no personalization</li>
            <li>Hitting a cold fan with flat pricing after a natural wave — it ends the wave</li>
            <li>Sending a fan a photo they&rsquo;ve already seen mid-drip-set</li>
            <li>Unlabeled audio clips the chatters can&rsquo;t find</li>
            <li>Old tier-1-to-tier-5 clutter nobody can make sense of</li>
          </ul>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
            What Jay&rsquo;s running on the growth side
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-white/85 leading-snug">
            <li>Instagram + TikTok ads (walking / reaction clips while Lucy&rsquo;s in town)</li>
            <li>Podcast booking support — PR girl handles adult podcast list</li>
            <li>Photo shoots + BTS lives during her May stay</li>
            <li>Possible Asia-side AI video channel using Lucy&rsquo;s China bank account</li>
            <li>AI chatbot training — the goal is replacing most chatters over time</li>
          </ul>
        </div>
      </div>

      <div className="mt-3 glass-inset rounded-2xl p-5">
        <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
          Revenue target set in the meeting
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

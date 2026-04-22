export function MeetingBrief() {
  return (
    <section className="section">
      <hr className="rule" />
      <div style={{ marginTop: "2rem" }}>
        <div className="eyebrow">The meeting</div>
        <h2 style={{ marginTop: "0.5rem" }}>In your own words</h2>
        <p className="lead" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
          You came back after a break. Everything below is pulled straight from the
          recordings &mdash; your vision, your plan, your rules.
        </p>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <blockquote>
          I want to be more organized and intentional with what&rsquo;s going out, even if
          it means in the short term we&rsquo;re making less money.
          <span className="quote-attr">Lucy &middot; meeting</span>
        </blockquote>
        <blockquote>
          I&rsquo;m not super pressed about it right now because I&rsquo;d rather start it
          right.
          <span className="quote-attr">Lucy &middot; meeting</span>
        </blockquote>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h3>Where we are right now</h3>
        <p className="body" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
          LiveRich took the account back over roughly 5 days ago. The previous agency let
          things slip &mdash; the clearest example is the whale on your account who spent
          around $11,000 and then got hit with <strong style={{ color: "var(--ink)" }}>
          $100, $100, $100</strong> in a row, no price variation, no personalization. He
          hasn&rsquo;t bought since. That pattern is what we&rsquo;re fixing first.
        </p>
        <p className="body" style={{ marginTop: "0.75rem", maxWidth: "62ch" }}>
          There&rsquo;s been a slide since your peak. We&rsquo;re focused on rebuilding
          your real fan base &mdash; not milking the top of it.
        </p>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h3>Where you want to go</h3>
        <p className="body" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          Your long-term vision, verbatim from the meeting:
        </p>
        <div style={{ marginTop: "1rem" }}>
          <blockquote>
            The reason why I want to go independent is&hellip; I feel like at this point,
            what I want to do is fix my brand, and how to fix it is for me to be personal.
            <span className="quote-attr">On your brand direction</span>
          </blockquote>
          <blockquote>
            In the long run, I do want &mdash; even if it means partnering with you &mdash;
            I do want to have all of this on lock. Pay you guys for certain things, but
            have my managers that I can meet with in person here. They know everything
            about all my content and they&rsquo;re managing chatters for me. So in the
            long term, that&rsquo;s what I would be working towards.
            <span className="quote-attr">On the partnership structure you want</span>
          </blockquote>
          <blockquote>
            I want to partner with you to some extent because I genuinely love all of your
            insight and your chatbot, obviously.
            <span className="quote-attr">On why you&rsquo;re back</span>
          </blockquote>
        </div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h3>The partnership split you described</h3>
        <p className="body" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          What the agency keeps handling vs. what you want to own directly. Because
          you&rsquo;re owning vault organization and script definition yourself, the
          agency percentage drops accordingly &mdash; we&rsquo;re charging for less work.
        </p>
        <div
          style={{
            marginTop: "1.25rem",
            display: "grid",
            gap: "2rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <div>
            <div className="eyebrow">Agency handles</div>
            <ul className="body" style={{ marginTop: "0.75rem", paddingLeft: "1.2rem" }}>
              <li style={{ marginBottom: "0.45rem" }}>
                Chatters (rotation, hiring, quality assurance)
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                The chatbot &mdash; learning your voice, your scripts, your patterns
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                Script library (pulling winning lead-ups from real sales)
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                Mass messages (timing, send volume, price variation)
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                Analytics, insight, pattern detection across your account
              </li>
              <li>
                Infrastructure &mdash; OF sync, webhook plumbing, automation
              </li>
            </ul>
          </div>
          <div>
            <div className="eyebrow">You own</div>
            <ul className="body" style={{ marginTop: "0.75rem", paddingLeft: "1.2rem" }}>
              <li style={{ marginBottom: "0.45rem" }}>
                Your brand direction and personality
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                All new content creation and your creative direction
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                Your personal assistant &mdash; trained by you to organize exactly the way
                you want
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                The vault: categories, sub-categories, bundles, labels
              </li>
              <li style={{ marginBottom: "0.45rem" }}>
                Script definition &mdash; every individual video and every bundle becomes
                its own script the way you structured it
              </li>
              <li>
                Long-term: your own in-person managers who know your content, reporting
                into you
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "3rem",
          display: "grid",
          gap: "2.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div>
          <h3>What you want to change</h3>
          <ul className="body" style={{ marginTop: "0.75rem", paddingLeft: "1.2rem" }}>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Your brand.</strong> Go more
              personal, more &ldquo;you&rdquo; &mdash; not generic.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>The vault.</strong> Clear
              categories, clean labels, delete the tier-1-to-tier-5 clutter that nobody
              could make sense of.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Drip sets.</strong> Each set gets
              its own list. Fans who&rsquo;ve seen any part of it never see a repeat
              &mdash; the live-and-naughty illusion breaks otherwise.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Sale hygiene.</strong> Chatters
              never sell from &ldquo;All media&rdquo; again. Only from curated folders
              &mdash; nothing that could be a custom, a drip, or content you didn&rsquo;t
              want out.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Conversation flow.</strong> Start
              fans from your oldest content and walk them forward &mdash; tell the story
              &mdash; instead of opening with the newest set.
            </li>
            <li style={{ marginBottom: "0.6rem" }}>
              <strong style={{ color: "var(--ink)" }}>Customs backlog.</strong> One live
              marathon to clear what&rsquo;s owed, then custom pricing goes up. No more
              $5&ndash;10 customs for a porn star.
            </li>
            <li>
              <strong style={{ color: "var(--ink)" }}>Chatter training.</strong> Quality
              assurance on every huddle, so the person we interviewed is the one actually
              on your account.
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
              listStyleType: "decimal",
            }}
          >
            <li style={{ marginBottom: "0.5rem" }}>
              Organize everything &mdash; vault, folders, sheets.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>Start writing scripts.</li>
            <li style={{ marginBottom: "0.5rem" }}>Add your personal assistant.</li>
            <li style={{ marginBottom: "0.5rem" }}>Debrief the assistant fully.</li>
            <li style={{ marginBottom: "0.5rem" }}>Clean up the Google sheets.</li>
            <li style={{ marginBottom: "0.5rem" }}>
              Upload the new content that&rsquo;s sitting.
            </li>
            <li>Create AI content (using the Chinese model tools we talked about).</li>
          </ol>

          <div style={{ marginTop: "2rem" }}>
            <h3>Your daily numbers</h3>
            <div className="body" style={{ marginTop: "0.75rem", display: "grid", gap: "0.4rem" }}>
              <div>
                <span className="num-small">$7,000</span>
                <span style={{ color: "var(--ink-mute)", marginLeft: "0.5rem" }}>
                  per day average &mdash; this is the floor we stay above
                </span>
              </div>
              <div>
                <span
                  style={{
                    color: "var(--accent)",
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.5rem",
                  }}
                >
                  $14,000
                </span>
                <span style={{ color: "var(--ink-mute)", marginLeft: "0.5rem" }}>
                  per day peak &mdash; where we&rsquo;re headed
                </span>
              </div>
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.2rem",
                    color: "var(--ink-mute)",
                  }}
                >
                  $4,000
                </span>
                <span style={{ color: "var(--ink-mute)", marginLeft: "0.5rem" }}>
                  low days &mdash; the ones we don&rsquo;t repeat
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h3>Your content roadmap for the page</h3>
        <p className="body" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          What you said you want rolling out, specifically on OnlyFans:
        </p>
        <ul
          className="body"
          style={{ marginTop: "0.75rem", paddingLeft: "1.2rem", maxWidth: "62ch" }}
        >
          <li style={{ marginBottom: "0.6rem" }}>
            <strong style={{ color: "var(--ink)" }}>Personalized clips.</strong> Lots of
            them. Your words: &ldquo;I want to make a lot of personalized clips.&rdquo;
            This is the brand-fix lever.
          </li>
          <li style={{ marginBottom: "0.6rem" }}>
            <strong style={{ color: "var(--ink)" }}>Clear every outstanding custom in
            one live marathon.</strong> Then lock in higher custom pricing as the new
            floor. No more under-$10 customs.
          </li>
          <li style={{ marginBottom: "0.6rem" }}>
            <strong style={{ color: "var(--ink)" }}>Upload the content that&rsquo;s
            sitting.</strong> You have new content ready &mdash; get it scheduled and
            out.
          </li>
          <li style={{ marginBottom: "0.6rem" }}>
            <strong style={{ color: "var(--ink)" }}>AI-generated content.</strong> Using
            the Chinese model tools (Qwen 3.0 / Alibaba&rsquo;s full-nude-capable stack).
            You&rsquo;re going to open access via your China phone/bank so we can test
            that lane.
          </li>
          <li style={{ marginBottom: "0.6rem" }}>
            <strong style={{ color: "var(--ink)" }}>Drip sets, properly tracked.</strong>{" "}
            Nighttime / daytime / BTS naming. New list per set. No fan sees a repeat
            mid-set.
          </li>
          <li>
            <strong style={{ color: "var(--ink)" }}>Journey-style sends.</strong> Start
            fans from 2021 content and walk them forward. Treat it as a story, not a
            catalog.
          </li>
        </ul>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h3>How the vault should be organized</h3>
        <p className="body" style={{ marginTop: "0.5rem", maxWidth: "62ch" }}>
          The structure you described &mdash; every individual video is its own script,
          and every themed bundle is its own script too.
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
              boy / girl &middot; girl / girl &middot; boy / boy / girl &middot; DP
            </div>
          </div>
          <div>
            <div className="eyebrow">Sub-categories</div>
            <div className="body" style={{ marginTop: "0.5rem" }}>
              breeding &middot; bondage &middot; anal &middot; anal creampie &middot; BBC
            </div>
          </div>
          <div>
            <div className="eyebrow">Bundles</div>
            <div className="body" style={{ marginTop: "0.5rem" }}>
              college girl &middot; squirting &middot; holidays
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

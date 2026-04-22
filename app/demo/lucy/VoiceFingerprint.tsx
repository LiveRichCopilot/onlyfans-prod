import type { VoiceFingerprint as VoiceData } from "@/lib/lucy-insights";

function fmtDuration(sec: number | null) {
  if (sec === null) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = sec / 60;
  if (m < 60) return `${m.toFixed(1)} min`;
  return `${(m / 60).toFixed(1)} hr`;
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-inset rounded-xl p-3 sm:p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-medium">{label}</div>
      <div className="mt-0.5 text-lg sm:text-xl font-semibold text-white tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

export function VoiceFingerprint({ voice }: { voice: VoiceData }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Voice fingerprint</h2>
      <p className="mt-1 text-sm text-white/50">
        How Lucy actually types — the DNA a chatbot needs to copy
      </p>

      <div className="mt-4 glass-card rounded-2xl p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCell
            label="Avg length"
            value={`${Math.round(voice.avgCharLength)} chars`}
            sub={`${voice.avgWordLength.toFixed(1)} words`}
          />
          <StatCell
            label="Median reply"
            value={fmtDuration(voice.medianReplySec)}
          />
          <StatCell
            label="Lowercase-only"
            value={`${voice.lowercaseOnlyPct.toFixed(0)}%`}
            sub="of messages"
          />
          <StatCell
            label="Trailing .."
            value={`${voice.trailingDotsPct.toFixed(0)}%`}
            sub={`${voice.emojiMidSentencePct.toFixed(0)}% mid-emoji`}
          />
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">Top emojis</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {voice.topEmojis.map((e) => (
              <div
                key={e.emoji}
                className="glass-inset rounded-full px-3 py-1.5 flex items-center gap-2"
              >
                <span className="text-lg leading-none">{e.emoji}</span>
                <span className="text-xs text-white/70">
                  {e.count.toLocaleString()}
                </span>
                <span className="text-[10px] text-white/40">
                  {e.pctOfMessages.toFixed(1)}%
                </span>
              </div>
            ))}
            {voice.topEmojis.length === 0 && (
              <div className="text-xs text-white/40">No emojis detected.</div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">Openers</div>
            <div className="mt-2 space-y-1.5">
              {voice.openers.slice(0, 8).map((o, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-white/85 break-words flex-1">&ldquo;{o.text}&rdquo;</span>
                  <span className="shrink-0 text-[11px] text-white/40">×{o.count}</span>
                </div>
              ))}
              {voice.openers.length === 0 && (
                <div className="text-xs text-white/40">No repeating openers.</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">Sign-offs</div>
            <div className="mt-2 space-y-1.5">
              {voice.signOffs.slice(0, 8).map((o, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-white/85 break-words flex-1">&ldquo;{o.text}&rdquo;</span>
                  <span className="shrink-0 text-[11px] text-white/40">×{o.count}</span>
                </div>
              ))}
              {voice.signOffs.length === 0 && (
                <div className="text-xs text-white/40">No repeating sign-offs.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 text-xs text-white/40">
          Based on {voice.totalMessages.toLocaleString()} of Lucy&rsquo;s messages.
        </div>
      </div>
    </section>
  );
}

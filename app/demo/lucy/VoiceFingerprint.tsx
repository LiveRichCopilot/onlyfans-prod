import { Clock, Type, CaseLower, MoreHorizontal, MessageCircle, Smile } from "lucide-react";
import type { VoiceFingerprint as VoiceData } from "@/lib/lucy-insights";

function fmtDuration(sec: number | null) {
  if (sec === null) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = sec / 60;
  if (m < 60) return `${m.toFixed(1)} min`;
  return `${(m / 60).toFixed(1)} hr`;
}

function StatCell({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="glass-inset rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-white/40">
        <Icon size={12} className="shrink-0" />
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="mt-1 text-lg sm:text-xl font-semibold text-white tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

export function VoiceFingerprint({ voice }: { voice: VoiceData }) {
  const emojiUsagePct =
    voice.totalMessages > 0
      ? ((voice.topEmojis.reduce((s, e) => s + e.count, 0) / voice.totalMessages) * 100).toFixed(0)
      : "0";

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} className="text-teal-300/80" />
        <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
          Voice fingerprint
        </h2>
      </div>
      <p className="mt-1 text-sm text-white/50">
        How Lucy actually types &mdash; the DNA a chatbot needs to copy
      </p>

      <div className="mt-4 glass-card rounded-2xl p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCell
            icon={Type}
            label="Avg length"
            value={`${Math.round(voice.avgCharLength)} chars`}
            sub={`${voice.avgWordLength.toFixed(1)} words`}
          />
          <StatCell
            icon={Clock}
            label="Median reply"
            value={fmtDuration(voice.medianReplySec)}
          />
          <StatCell
            icon={CaseLower}
            label="Lowercase-only"
            value={`${voice.lowercaseOnlyPct.toFixed(0)}%`}
            sub="of messages"
          />
          <StatCell
            icon={MoreHorizontal}
            label="Trailing dots"
            value={`${voice.trailingDotsPct.toFixed(0)}%`}
            sub={`${voice.emojiMidSentencePct.toFixed(0)}% mid-line`}
          />
        </div>

        <div className="mt-5 glass-inset rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-white/40">
            <Smile size={12} className="shrink-0" />
            <span className="text-[10px] uppercase tracking-wider font-medium">
              Punctuation &amp; emotion usage
            </span>
          </div>
          <p className="mt-1.5 text-[14px] text-white/90 leading-relaxed">
            She uses <span className="text-white font-semibold">{emojiUsagePct}%</span> rate of
            emotion markers across her messages. Lowercase-only writing dominates, trailing{" "}
            <span className="text-white font-mono">..</span> is her rhythm, and reactions tend to
            land mid-sentence rather than at the end.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
              How she opens
            </div>
            <div className="mt-2 space-y-1.5">
              {voice.openers.slice(0, 8).map((o, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-white/85 break-words flex-1">&ldquo;{o.text}&rdquo;</span>
                  <span className="shrink-0 text-[11px] text-white/40">&times;{o.count}</span>
                </div>
              ))}
              {voice.openers.length === 0 && (
                <div className="text-xs text-white/40">No repeating openers.</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
              How she signs off
            </div>
            <div className="mt-2 space-y-1.5">
              {voice.signOffs.slice(0, 8).map((o, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-white/85 break-words flex-1">&ldquo;{o.text}&rdquo;</span>
                  <span className="shrink-0 text-[11px] text-white/40">&times;{o.count}</span>
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

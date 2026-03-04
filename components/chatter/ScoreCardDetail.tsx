/**
 * ScoreCardDetail — Expanded detail view for a chatter's score card.
 * Shows category bars, penalty badges, strength/weakness tags,
 * notable quotes, AI notes, and stats.
 */

import {
  Clock,
  MessageSquare,
  Target,
  Heart,
  DollarSign,
  Bot,
  Sparkles,
} from "lucide-react";
import { CategoryBar } from "@/components/chatter/CategoryBar";
import type { ScoreEntry } from "@/components/chatter/ScoreTypes";

export function ScoreCardDetail({ entry }: { entry: ScoreEntry }) {
  const cs = entry.currentScore;

  return (
    <div className="px-5 pb-5 pt-0 border-t border-solid border-white/5">
      {/* Category Bars */}
      <div className="mt-4 space-y-2.5">
        <CategoryBar
          label="SLA / Response Time"
          score={cs?.slaScore ?? Math.round(entry.profile?.avgSlaScore ?? 0)}
          max={25}
          icon={<Clock size={12} />}
        />
        <CategoryBar
          label="Follow-up Discipline"
          score={cs?.followupScore ?? Math.round(entry.profile?.avgFollowupScore ?? 0)}
          max={20}
          icon={<MessageSquare size={12} />}
        />
        <CategoryBar
          label="Trigger Handling"
          score={cs?.triggerScore ?? Math.round(entry.profile?.avgTriggerScore ?? 0)}
          max={20}
          icon={<Target size={12} />}
        />
        <CategoryBar
          label="Quality / Personalization"
          score={cs?.qualityScore ?? Math.round(entry.profile?.avgQualityScore ?? 0)}
          max={20}
          icon={<Heart size={12} />}
        />
        <CategoryBar
          label="Revenue Impact"
          score={cs?.revenueScore ?? Math.round(entry.profile?.avgRevenueScore ?? 0)}
          max={15}
          icon={<DollarSign size={12} />}
        />
      </div>

      {/* Penalties */}
      {cs && (cs.copyPastePenalty !== 0 || cs.missedTriggerPenalty !== 0 || cs.spamPenalty !== 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cs.copyPastePenalty !== 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
              Copy/Paste -10
            </span>
          )}
          {cs.missedTriggerPenalty !== 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
              Missed Trigger -10
            </span>
          )}
          {cs.spamPenalty !== 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
              Spam -10
            </span>
          )}
        </div>
      )}

      {/* Strength Tags */}
      {(cs?.strengthTags?.length ?? 0) > 0 && (
        <div className="mt-3">
          <span className="text-white/30 text-[10px] uppercase tracking-wider">
            Strengths
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {cs!.strengthTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-solid border-emerald-500/20"
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mistake Tags */}
      {(cs?.mistakeTags?.length ?? 0) > 0 && (
        <div className="mt-2">
          <span className="text-white/30 text-[10px] uppercase tracking-wider">
            Needs Improvement
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {cs!.mistakeTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-solid border-orange-500/20"
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notable Quotes */}
      {cs?.notableQuotes && cs.notableQuotes.length > 0 && (
        <div className="mt-3">
          <span className="text-white/30 text-[10px] uppercase tracking-wider">
            Notable Quotes
          </span>
          <div className="mt-1.5 space-y-1.5">
            {cs.notableQuotes.map((q, qi) => {
              const typeStyle =
                q.type === "great"
                  ? "bg-emerald-500/5 border-emerald-500/15"
                  : q.type === "good"
                    ? "bg-teal-500/5 border-teal-500/15"
                    : q.type === "bad"
                      ? "bg-orange-500/5 border-orange-500/15"
                      : "bg-red-500/5 border-red-500/15";
              const textStyle =
                q.type === "great"
                  ? "text-emerald-400/90"
                  : q.type === "good"
                    ? "text-teal-400/90"
                    : q.type === "bad"
                      ? "text-orange-400/90"
                      : "text-red-400/90";
              const badgeStyle =
                q.type === "great"
                  ? "bg-emerald-500/10 text-emerald-400/70"
                  : q.type === "good"
                    ? "bg-teal-500/10 text-teal-400/70"
                    : q.type === "bad"
                      ? "bg-orange-500/10 text-orange-400/70"
                      : "bg-red-500/10 text-red-400/70";
              const emoji =
                q.type === "great" ? "⭐" : q.type === "good" ? "✅" : q.type === "bad" ? "⚠️" : "💀";

              return (
                <div key={qi} className={`p-2.5 rounded-xl border border-solid ${typeStyle}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm shrink-0 mt-0.5">{emoji}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium italic ${textStyle}`}>
                        &ldquo;{q.text}&rdquo;
                      </p>
                      {q.context && (
                        <p className="text-white/25 text-[10px] mt-0.5">{q.context}</p>
                      )}
                    </div>
                    <span
                      className={`text-[9px] uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-md ${badgeStyle}`}
                    >
                      {q.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Notes */}
      {cs?.aiNotes && (
        <div className="mt-3 p-3 rounded-xl bg-white/3 border border-solid border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={10} className="text-purple-400" />
            <span className="text-white/30 text-[10px] uppercase tracking-wider">
              AI Notes
            </span>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">{cs.aiNotes}</p>
        </div>
      )}

      {/* Stats Row */}
      {cs && (
        <div className="mt-3 flex items-center gap-4 text-white/30 text-[10px]">
          <span className="flex items-center gap-1">
            <MessageSquare size={9} />
            {cs.messagesAnalyzed} msgs
          </span>
          <span>{cs.conversationsScanned} chats</span>
          <span className="flex items-center gap-1">
            <Bot size={9} />
            {cs.robotPhraseCount} robot
          </span>
        </div>
      )}
    </div>
  );
}

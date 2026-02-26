"use client";

import { Sparkles, Bot, MessageSquare } from "lucide-react";
import {
  type ScoreEntry,
  CategoryBar,
  Clock,
  Target,
  Heart,
  DollarSign,
} from "./ScoreComponents";

export function ScoreExpandedDetail({ entry }: { entry: ScoreEntry }) {
  return (
    <div className="px-5 pb-5 pt-0 border-t border-solid border-white/5">
      <div className="mt-4 space-y-2.5">
        <CategoryBar
          label="SLA / Response Time"
          score={
            entry.currentScore?.slaScore ??
            Math.round(entry.profile?.avgSlaScore ?? 0)
          }
          max={25}
          icon={<Clock size={12} />}
        />
        <CategoryBar
          label="Follow-up Discipline"
          score={
            entry.currentScore?.followupScore ??
            Math.round(entry.profile?.avgFollowupScore ?? 0)
          }
          max={20}
          icon={<MessageSquare size={12} />}
        />
        <CategoryBar
          label="Trigger Handling"
          score={
            entry.currentScore?.triggerScore ??
            Math.round(entry.profile?.avgTriggerScore ?? 0)
          }
          max={20}
          icon={<Target size={12} />}
        />
        <CategoryBar
          label="Quality / Personalization"
          score={
            entry.currentScore?.qualityScore ??
            Math.round(entry.profile?.avgQualityScore ?? 0)
          }
          max={20}
          icon={<Heart size={12} />}
        />
        <CategoryBar
          label="Revenue Impact"
          score={
            entry.currentScore?.revenueScore ??
            Math.round(entry.profile?.avgRevenueScore ?? 0)
          }
          max={15}
          icon={<DollarSign size={12} />}
        />
      </div>

      {/* Penalties */}
      {entry.currentScore &&
        (entry.currentScore.copyPastePenalty !== 0 ||
          entry.currentScore.missedTriggerPenalty !== 0 ||
          entry.currentScore.spamPenalty !== 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.currentScore.copyPastePenalty !== 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
                Copy/Paste -10
              </span>
            )}
            {entry.currentScore.missedTriggerPenalty !== 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
                Missed Trigger -10
              </span>
            )}
            {entry.currentScore.spamPenalty !== 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-solid border-red-500/20">
                Spam -10
              </span>
            )}
          </div>
        )}

      {/* Tags */}
      {(entry.currentScore?.strengthTags?.length ?? 0) > 0 && (
        <div className="mt-3">
          <span className="text-white/30 text-[10px] uppercase tracking-wider">
            Strengths
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.currentScore!.strengthTags.map((tag) => (
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

      {(entry.currentScore?.mistakeTags?.length ?? 0) > 0 && (
        <div className="mt-2">
          <span className="text-white/30 text-[10px] uppercase tracking-wider">
            Needs Improvement
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.currentScore!.mistakeTags.map((tag) => (
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
      {entry.currentScore?.notableQuotes && entry.currentScore.notableQuotes.length > 0 && (
        <div className="mt-3">
          <span className="text-white/30 text-[10px] uppercase tracking-wider">
            Notable Quotes
          </span>
          <div className="mt-1.5 space-y-1.5">
            {entry.currentScore.notableQuotes.map((q, qi) => (
              <div key={qi} className={`p-2.5 rounded-xl border border-solid ${
                q.type === "great" ? "bg-emerald-500/5 border-emerald-500/15" :
                q.type === "good" ? "bg-teal-500/5 border-teal-500/15" :
                q.type === "bad" ? "bg-orange-500/5 border-orange-500/15" :
                "bg-red-500/5 border-red-500/15"
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0 mt-0.5">
                    {q.type === "great" ? "⭐" : q.type === "good" ? "✅" : q.type === "bad" ? "⚠️" : "💀"}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium italic ${
                      q.type === "great" ? "text-emerald-400/90" :
                      q.type === "good" ? "text-teal-400/90" :
                      q.type === "bad" ? "text-orange-400/90" :
                      "text-red-400/90"
                    }`}>
                      &ldquo;{q.text}&rdquo;
                    </p>
                    {q.context && (
                      <p className="text-white/25 text-[10px] mt-0.5">{q.context}</p>
                    )}
                  </div>
                  <span className={`text-[9px] uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-md ${
                    q.type === "great" ? "bg-emerald-500/10 text-emerald-400/70" :
                    q.type === "good" ? "bg-teal-500/10 text-teal-400/70" :
                    q.type === "bad" ? "bg-orange-500/10 text-orange-400/70" :
                    "bg-red-500/10 text-red-400/70"
                  }`}>
                    {q.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Notes */}
      {entry.currentScore?.aiNotes && (
        <div className="mt-3 p-3 rounded-xl bg-white/3 border border-solid border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={10} className="text-purple-400" />
            <span className="text-white/30 text-[10px] uppercase tracking-wider">
              AI Notes
            </span>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">
            {entry.currentScore.aiNotes}
          </p>
        </div>
      )}

      {/* Stats Row */}
      {entry.currentScore && (
        <div className="mt-3 flex items-center gap-4 text-white/30 text-[10px]">
          <span className="flex items-center gap-1">
            <MessageSquare size={9} />
            {entry.currentScore.messagesAnalyzed} msgs
          </span>
          <span>
            {entry.currentScore.conversationsScanned} chats
          </span>
          <span className="flex items-center gap-1">
            <Bot size={9} />
            {entry.currentScore.robotPhraseCount} robot
          </span>
        </div>
      )}
    </div>
  );
}

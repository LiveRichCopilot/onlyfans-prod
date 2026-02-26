"use client";

import { CheckCircle, XCircle, Zap, BookOpen, TrendingUp, Heart, Sparkles } from "lucide-react";

type PatternStep = {
  description: string;
  achieved: boolean;
  messageRef?: number;
};

type StoryArc = {
  title: string;
  messageRange: [number, number];
  sellCount: number;
  sellQuotes: string[];
  storyFlowAnalysis: string;
  fanInvestment: string;
  keyElements: string[];
  sellingPattern: PatternStep[];
};

type StoryAnalysis = {
  storyArcs: StoryArc[];
  overallSellingScore: number;
  fanInvestmentMoment: string | null;
};

type Props = {
  storyAnalysis: StoryAnalysis | null;
  totalScore: number;
  aiNotes: string | null;
  strengthTags: string[];
  mistakeTags: string[];
};

function formatTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(score: number): string {
  if (score >= 80) return "#34D399";
  if (score >= 60) return "#2DD4BF";
  if (score >= 40) return "#FBBF24";
  return "#F87171";
}

/**
 * Story Breakdown analysis panel shown alongside the phone frame.
 * Displays selling patterns, fan investment, story arc details.
 */
export function StoryBreakdownPanel({ storyAnalysis, totalScore, aiNotes, strengthTags, mistakeTags }: Props) {
  const arcs = storyAnalysis?.storyArcs || [];
  const hasStory = arcs.length > 0;
  const totalSells = arcs.reduce((sum, a) => sum + (a.sellCount || 0), 0);
  // If there are actual sells, badge should be green regardless of technique score
  const sellingBadgeColor = totalSells > 0 ? "#34D399" : scoreColor(storyAnalysis?.overallSellingScore || 0);

  return (
    <div className="flex-1 min-w-[280px] max-w-[420px] space-y-3 overflow-y-auto max-h-[580px] custom-scrollbar">
      {/* Overall selling score */}
      {hasStory && storyAnalysis && (
        <div className="glass-inset rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white text-xs font-semibold flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" /> Selling Technique
            </h4>
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{
                background: `${sellingBadgeColor}15`,
                color: sellingBadgeColor,
                border: `1px solid ${sellingBadgeColor}30`,
              }}
            >
              {storyAnalysis.overallSellingScore}/100
              {totalSells > 0 && <span className="ml-1">({totalSells} sale{totalSells > 1 ? "s" : ""})</span>}
            </div>
          </div>
          {storyAnalysis.fanInvestmentMoment && (
            <p className="text-white/80 text-[11px] leading-relaxed">
              <Heart size={10} className="inline text-pink-400 mr-1" />
              {storyAnalysis.fanInvestmentMoment}
            </p>
          )}
        </div>
      )}

      {/* Story Arcs */}
      {arcs.map((arc, ai) => (
        <div key={ai} className="glass-inset rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen size={13} className="text-purple-400 shrink-0" />
            <h4 className="text-white text-xs font-semibold">
              Story {ai + 1}: {arc.title}
            </h4>
          </div>

          {/* Story length */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-white/60">
              Messages #{arc.messageRange[0]}–#{arc.messageRange[1]}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-white/60">
              {arc.messageRange[1] - arc.messageRange[0] + 1} messages
            </span>
          </div>

          {/* Sells within story — GREEN because sales are always positive */}
          {arc.sellCount > 0 && (
            <div className="bg-emerald-500/[0.08] rounded-xl p-2.5 border border-emerald-500/15">
              <p className="text-emerald-400 text-[10px] font-semibold mb-1.5">
                <Zap size={10} className="inline mr-1" />
                {arc.sellCount} Sell{arc.sellCount > 1 ? "s" : ""} Within Story
              </p>
              {arc.sellQuotes.slice(0, 3).map((q, qi) => (
                <p key={qi} className="text-white/70 text-[10px] leading-relaxed pl-3 border-l border-emerald-500/20 mb-1">
                  &ldquo;{q.slice(0, 200)}&rdquo;
                </p>
              ))}
            </div>
          )}

          {/* Story flow analysis */}
          {arc.storyFlowAnalysis && (
            <div>
              <p className="text-white/80 text-[9px] uppercase tracking-wider font-semibold mb-1">Story Flow</p>
              <p className="text-white/80 text-[11px] leading-relaxed">{arc.storyFlowAnalysis}</p>
            </div>
          )}

          {/* Fan investment */}
          {arc.fanInvestment && (
            <div>
              <p className="text-white/80 text-[9px] uppercase tracking-wider font-semibold mb-1">Fan Investment</p>
              <p className="text-white/80 text-[11px] leading-relaxed">
                <TrendingUp size={10} className="inline text-emerald-400 mr-1" />
                {arc.fanInvestment}
              </p>
            </div>
          )}

          {/* Key elements */}
          {arc.keyElements.length > 0 && (
            <div>
              <p className="text-white/80 text-[9px] uppercase tracking-wider font-semibold mb-1.5">Key Elements</p>
              <div className="flex flex-wrap gap-1">
                {arc.keyElements.map((el, ei) => (
                  <span key={ei} className="text-[9px] bg-white/[0.06] text-white/80 px-2 py-0.5 rounded-full border border-white/10">
                    {el}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Selling pattern checklist */}
          {arc.sellingPattern.length > 0 && (
            <div>
              <p className="text-white/80 text-[9px] uppercase tracking-wider font-semibold mb-1.5">Selling Pattern</p>
              <div className="space-y-1">
                {arc.sellingPattern.map((step, si) => (
                  <div key={si} className="flex items-start gap-1.5">
                    {step.achieved ? (
                      <CheckCircle size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={11} className="text-red-400/60 shrink-0 mt-0.5" />
                    )}
                    <span className={`text-[10px] leading-relaxed ${step.achieved ? "text-white/90" : "text-white/60"}`}>
                      {step.description}
                      {step.messageRef != null && (
                        <span className="text-white/50 ml-1">#{step.messageRef}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* AI Notes */}
      {aiNotes && (
        <div className="glass-inset rounded-2xl p-4">
          <p className="text-white/80 text-[9px] uppercase tracking-wider font-semibold mb-1.5">AI Analysis</p>
          <p className="text-white/90 text-[11px] leading-relaxed">{aiNotes}</p>
        </div>
      )}

      {/* Strengths & Mistakes */}
      {(strengthTags.length > 0 || mistakeTags.length > 0) && (
        <div className="glass-inset rounded-2xl p-4 space-y-2">
          <p className="text-white/80 text-[9px] uppercase tracking-wider font-semibold mb-1">What Worked / What Didn&apos;t</p>
          {strengthTags.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <CheckCircle size={11} className="text-teal-400 shrink-0" />
              <span className="text-teal-300 text-[10px]">{formatTag(t)}</span>
            </div>
          ))}
          {mistakeTags.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <XCircle size={11} className="text-red-400 shrink-0" />
              <span className="text-red-300 text-[10px]">{formatTag(t)}</span>
            </div>
          ))}
        </div>
      )}

      {/* No story data fallback */}
      {!hasStory && !aiNotes && (
        <div className="glass-inset rounded-2xl p-6 flex items-center justify-center">
          <p className="text-white/25 text-xs">No story analysis available for this conversation</p>
        </div>
      )}
    </div>
  );
}

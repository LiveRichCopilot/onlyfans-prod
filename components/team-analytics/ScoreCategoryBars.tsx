"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import { ExportButtons } from "./ExportButtons";
import { CHART_COLORS, scoreColor } from "./chart-colors";

type CategoryAverages = {
  sla: number;
  followup: number;
  trigger: number;
  quality: number;
  revenue: number;
};

export type ConversationSample = {
  chatterName: string;
  chatterEmail: string;
  creator: string;
  date: string;
  totalScore: number;
  slaScore: number;
  followupScore: number;
  triggerScore: number;
  qualityScore: number;
  revenueScore: number;
  archetype: string | null;
  aiNotes: string | null;
  conversationData: unknown;
  mistakeTags: string[];
  strengthTags: string[];
};

type ScoreKey = "slaScore" | "followupScore" | "triggerScore" | "qualityScore" | "revenueScore";

const CATEGORIES: Array<{
  key: keyof CategoryAverages;
  scoreKey: ScoreKey;
  label: string;
  hint: string;
  max: number;
  color: string;
}> = [
  { key: "sla", scoreKey: "slaScore", label: "SLA", hint: "How fast they reply — under 5 min = full marks", max: 25, color: CHART_COLORS.blue },
  { key: "followup", scoreKey: "followupScore", label: "Follow-up", hint: "Do they chase fans who go quiet, or let them drift?", max: 20, color: CHART_COLORS.teal },
  { key: "trigger", scoreKey: "triggerScore", label: "Triggers", hint: "Fan hints they want content — did the chatter sell immediately?", max: 20, color: CHART_COLORS.purple },
  { key: "quality", scoreKey: "qualityScore", label: "Quality", hint: "Personal, in-character messages vs robotic copy-paste", max: 20, color: CHART_COLORS.amber },
  { key: "revenue", scoreKey: "revenueScore", label: "Revenue", hint: "Did they actually close? PPV sent, tip received, sub renewed", max: 15, color: CHART_COLORS.emerald },
];

type Props = {
  data: CategoryAverages;
  conversations?: ConversationSample[];
  onViewConversation?: (sample: ConversationSample) => void;
};

export function ScoreCategoryBars({ data, conversations = [], onViewConversation }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const chartData = CATEGORIES.map(c => ({
    ...c,
    name: c.label,
    score: data[c.key],
    pct: Math.round((data[c.key] / c.max) * 100),
  }));

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Score Breakdown</h3>
          <p className="text-white/40 text-xs mt-0.5">
            {conversations.length > 0
              ? "Click any category to see the actual conversations"
              : "Each chatter is scored out of 100 every hour"}
          </p>
        </div>
        <ExportButtons data={chartData} filename="score-breakdown" columns={["name", "score", "max", "pct"]} />
      </div>
      <div className="space-y-1">
        {chartData.map(c => {
          const isOpen = expanded === c.key;
          const catConversations = conversations
            .filter(conv => conv[c.scoreKey] !== undefined)
            .sort((a, b) => b[c.scoreKey] - a[c.scoreKey]);
          const hasConversations = catConversations.length > 0;

          return (
            <div key={c.key}>
              <button
                onClick={() => {
                  if (!hasConversations) return;
                  setExpanded(isOpen ? null : c.key);
                }}
                className={`w-full text-left py-2 px-1 rounded-lg transition ${hasConversations ? "hover:bg-white/[0.03] cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white font-medium">
                    {c.name}
                    <span className="text-white/40 text-[10px] ml-1.5">{c.hint}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-white font-semibold tabular-nums">{c.score}/{c.max}</span>
                    {hasConversations && (
                      isOpen
                        ? <ChevronUp size={12} className="text-white/30" />
                        : <ChevronDown size={12} className="text-white/30" />
                    )}
                  </span>
                </div>
                <div className="h-2.5 glass-inset rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, background: c.color }} />
                </div>
              </button>

              {/* Drill-down: conversations for this category */}
              {isOpen && (
                <div className="mt-1 mb-3 space-y-1.5 ml-1 max-h-[400px] overflow-y-auto">
                  <div className="text-[9px] text-white/50 uppercase tracking-wider font-semibold px-2">
                    {catConversations.length} scored conversation{catConversations.length !== 1 ? "s" : ""} — sorted by {c.label} score
                  </div>
                  {catConversations.slice(0, 8).map((conv, i) => {
                    const catScore = conv[c.scoreKey];
                    const catPct = Math.round((catScore / c.max) * 100);
                    return (
                      <div
                        key={`${conv.chatterEmail}-${conv.date}-${i}`}
                        onClick={() => onViewConversation?.(conv)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl glass-inset ${onViewConversation ? "cursor-pointer hover:bg-white/[0.04]" : ""}`}
                      >
                        {/* Score badge */}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{
                            background: `${scoreColor(catPct)}15`,
                            color: scoreColor(catPct),
                            border: `1px solid ${scoreColor(catPct)}30`,
                          }}
                        >
                          {catScore}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white text-[11px] font-medium truncate">{conv.chatterName}</span>
                            <span className="text-white/30 text-[10px]">&rarr;</span>
                            <span className="text-white/50 text-[10px] truncate">{conv.creator}</span>
                          </div>
                          {conv.aiNotes && (
                            <p className="text-white/60 text-[10px] leading-snug line-clamp-2 mt-0.5">
                              {conv.aiNotes}
                            </p>
                          )}
                        </div>

                        {/* View button */}
                        {onViewConversation && (
                          <Eye size={12} className="text-white/20 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {catConversations.length > 8 && (
                    <div className="text-[10px] text-white/30 text-center py-1">
                      +{catConversations.length - 8} more conversations
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

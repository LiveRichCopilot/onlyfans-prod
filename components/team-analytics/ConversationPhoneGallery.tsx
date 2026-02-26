"use client";

import { useState } from "react";
import { Trophy, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ExportButtons } from "./ExportButtons";
import { scoreColor } from "./chart-colors";
import { PhoneFrame, MiniPhone } from "./PhoneFrame";
import { StoryChatBubbles } from "./StoryChatBubbles";
import { StoryBreakdownPanel } from "./StoryBreakdownPanel";

type Message = { text: string; isChatter: boolean; time: string };
type Conversation = { chatId: string; fanName: string; messages: Message[] };

type ConversationSample = {
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
  notableQuotes: any;
  conversationData: any;
  mistakeTags: string[];
  strengthTags: string[];
  penalties: { copyPaste: number; missedTrigger: number; spam: number };
};

function formatTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractConversations(data: any): Conversation[] {
  if (!data) return [];
  // Enriched format: { conversations: [...], storyAnalysis: {...} }
  if (data.conversations && Array.isArray(data.conversations)) return data.conversations;
  // Legacy flat array format
  if (Array.isArray(data)) return data;
  return [];
}

function extractStoryAnalysis(data: any): any | null {
  if (!data) return null;
  if (data.storyAnalysis) return data.storyAnalysis;
  return null;
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/70 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 glass-inset rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: scoreColor(pct) }} />
      </div>
      <span className="text-[10px] text-white/70 tabular-nums w-8 text-right">{score}/{max}</span>
    </div>
  );
}

/**
 * Expanded view: PhoneFrame with chat bubbles + StoryBreakdownPanel side by side.
 */
function ExpandedConversation({
  sample,
  convoIndex,
  onConvoChange,
  onClose,
}: {
  sample: ConversationSample;
  convoIndex: number;
  onConvoChange: (i: number) => void;
  onClose: () => void;
}) {
  const conversations = extractConversations(sample.conversationData);
  const fullStoryAnalysis = extractStoryAnalysis(sample.conversationData);
  const convo = conversations[convoIndex];

  if (!convo) return null;

  // Filter story arcs to match the CURRENT chat being viewed
  const fanName = convo.fanName?.toLowerCase() || "";
  const filteredArcs = (fullStoryAnalysis?.storyArcs || []).filter((arc: any) => {
    const titleLower = (arc.title || "").toLowerCase();
    // Match if arc title contains the fan name (e.g. "Matt's Bold Escalation" matches "Matt")
    return fanName && titleLower.includes(fanName.split(" ")[0]);
  });

  // Build a filtered story analysis for this specific chat
  const storyAnalysis = fullStoryAnalysis && filteredArcs.length > 0
    ? { ...fullStoryAnalysis, storyArcs: filteredArcs }
    : filteredArcs.length > 0 ? { storyArcs: filteredArcs, overallSellingScore: 0, fanInvestmentMoment: null } : null;

  const isTooShort = convo.messages.length < 5;

  return (
    <div className="glass-inset rounded-3xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${scoreColor(sample.totalScore)}15`,
              border: `1px solid ${scoreColor(sample.totalScore)}30`,
            }}
          >
            <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(sample.totalScore) }}>
              {sample.totalScore}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{sample.chatterName}</span>
              <span className="text-white/20">→</span>
              <span className="text-white/50 text-sm">{sample.creator}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/60 text-[10px]">
                {new Date(sample.date).toLocaleDateString("en-GB", {
                  timeZone: "Europe/London",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {sample.archetype && (
                <span className="text-purple-400/60 text-[10px] bg-purple-500/10 px-1.5 py-0.5 rounded">
                  {formatTag(sample.archetype)}
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="glass-button rounded-xl p-2 text-white/40 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-5 gap-x-4 gap-y-1">
        <ScoreBar label="SLA" score={sample.slaScore} max={25} />
        <ScoreBar label="Follow-up" score={sample.followupScore} max={20} />
        <ScoreBar label="Triggers" score={sample.triggerScore} max={20} />
        <ScoreBar label="Quality" score={sample.qualityScore} max={20} />
        <ScoreBar label="Revenue" score={sample.revenueScore} max={15} />
      </div>

      {/* Conversation nav */}
      {conversations.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onConvoChange(Math.max(0, convoIndex - 1))}
            disabled={convoIndex === 0}
            className="glass-button rounded-lg p-1.5 text-white/50 hover:text-white disabled:opacity-20"
          >
            <ChevronLeft size={14} />
          </button>
          {conversations.map((c: Conversation, ci: number) => (
            <button
              key={ci}
              onClick={() => onConvoChange(ci)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition ${
                ci === convoIndex
                  ? "glass-prominent text-white"
                  : c.messages.length < 5
                    ? "glass-button text-white/30"
                    : "glass-button text-white/60 hover:text-white"
              }`}
            >
              {c.fanName} ({c.messages.length})
            </button>
          ))}
          <button
            onClick={() => onConvoChange(Math.min(conversations.length - 1, convoIndex + 1))}
            disabled={convoIndex === conversations.length - 1}
            className="glass-button rounded-lg p-1.5 text-white/50 hover:text-white disabled:opacity-20"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Phone + Story Breakdown side by side */}
      <div className="flex gap-5 items-start">
        <PhoneFrame
          header={
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-medium">{convo.fanName}</span>
              <span className="text-white/50 text-[10px]">{convo.messages.length} msgs</span>
            </div>
          }
        >
          <StoryChatBubbles
            messages={convo.messages}
            storyArcs={filteredArcs}
            autoScrollToFirstSell
          />
        </PhoneFrame>

        {isTooShort ? (
          <div className="flex-1 min-w-[280px] max-w-[420px] glass-inset rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
            <p className="text-white/50 text-sm font-medium">Too short to analyze</p>
            <p className="text-white/40 text-xs text-center leading-relaxed">
              This conversation only has {convo.messages.length} message{convo.messages.length !== 1 ? "s" : ""}.
              Story analysis requires at least 5 messages of back-and-forth.
            </p>
          </div>
        ) : (
          <StoryBreakdownPanel
            storyAnalysis={storyAnalysis}
            totalScore={sample.totalScore}
            aiNotes={sample.aiNotes}
            strengthTags={sample.strengthTags}
            mistakeTags={sample.mistakeTags}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Phone gallery grid replacing ConversationScoringSection.
 * Mini phone thumbnails → click to expand to full phone + story breakdown.
 */
export function ConversationPhoneGallery({ data }: { data: ConversationSample[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [convoIndex, setConvoIndex] = useState(0);

  const exportData = data.map((d) => ({
    chatter: d.chatterName,
    creator: d.creator,
    date: d.date,
    total: d.totalScore,
    sla: d.slaScore,
    followup: d.followupScore,
    trigger: d.triggerScore,
    quality: d.qualityScore,
    revenue: d.revenueScore,
    archetype: d.archetype || "",
    strengths: d.strengthTags.join(", "),
    mistakes: d.mistakeTags.join(", "),
    notes: d.aiNotes || "",
  }));

  function handleSelect(i: number) {
    if (selectedIdx === i) {
      setSelectedIdx(null);
    } else {
      setSelectedIdx(i);
      setConvoIndex(0);
    }
  }

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" /> Conversation Scoring
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Click a phone to expand the full conversation with story analysis
          </p>
        </div>
        <ExportButtons data={exportData} filename="conversation-scoring" />
      </div>

      {data.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-white/30 text-sm">
          No scored conversations yet
        </div>
      ) : (
        <>
          {/* Mini phone grid */}
          <div className="flex flex-wrap gap-3 mb-4">
            {data.map((sample, i) => {
              const convos = extractConversations(sample.conversationData);
              const firstFan = convos[0]?.fanName || "No chats";
              const totalMsgs = convos.reduce((acc: number, c: Conversation) => acc + c.messages.length, 0);

              return (
                <MiniPhone
                  key={i}
                  chatterName={sample.chatterName}
                  fanName={`${sample.creator} · ${firstFan}`}
                  score={sample.totalScore}
                  messageCount={totalMsgs}
                  isSelected={selectedIdx === i}
                  onClick={() => handleSelect(i)}
                />
              );
            })}
          </div>

          {/* Expanded view */}
          {selectedIdx !== null && data[selectedIdx] && (
            <ExpandedConversation
              sample={data[selectedIdx]}
              convoIndex={convoIndex}
              onConvoChange={setConvoIndex}
              onClose={() => setSelectedIdx(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * ConversationPhoneGrid — Grid of mini phone cards.
 * Click one to expand it with the StoryBreakdownPanel beside it.
 * Replaces the old flat-list conversation scoring section.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatPhoneCard, type ChatPhoneData } from "@/components/chatter/ChatPhoneCard";
import { StoryBreakdownPanel, type StoryAnalysis } from "@/components/chatter/StoryBreakdownPanel";

export type ConversationWithAnalysis = {
  phone: ChatPhoneData;
  analysis?: StoryAnalysis;
};

export function ConversationPhoneGrid({
  conversations,
  title = "Scored Conversations",
}: {
  conversations: ConversationWithAnalysis[];
  title?: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  if (conversations.length === 0) return null;

  const selected = selectedIdx !== null ? conversations[selectedIdx] : null;

  return (
    <div className="glass-card rounded-2xl border border-solid border-white/8 overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <p className="text-white/30 text-xs mt-0.5">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""} scored
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-white/30" />
        ) : (
          <ChevronDown size={16} className="text-white/30" />
        )}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5">
          {/* Phone Grid — horizontal scroll on mobile, wrapping grid on desktop */}
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/10 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
            {conversations.map((conv, idx) => (
              <div key={conv.phone.chatId} className="shrink-0 sm:shrink">
                <ChatPhoneCard
                  data={conv.phone}
                  isSelected={selectedIdx === idx}
                  onSelect={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                  compact
                />
              </div>
            ))}
          </div>

          {/* Expanded: Selected phone + Story Breakdown side by side */}
          {selected && (
            <div className="mt-5 flex flex-col lg:flex-row gap-5">
              {/* Full-size phone */}
              <div className="shrink-0">
                <ChatPhoneCard data={selected.phone} isSelected />
              </div>

              {/* Story Breakdown Panel */}
              {selected.analysis ? (
                <div className="flex-1 min-w-0">
                  <StoryBreakdownPanel
                    analysis={selected.analysis}
                    messages={selected.phone.messages}
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center justify-center p-8 rounded-2xl border border-solid border-white/5 bg-white/[0.02]">
                  <p className="text-white/25 text-sm text-center">
                    Story analysis will appear here after the AI scorer labels this conversation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

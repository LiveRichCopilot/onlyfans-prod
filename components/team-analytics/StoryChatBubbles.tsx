"use client";

import { useEffect, useRef } from "react";

type Message = { text: string; isChatter: boolean; time: string };

type MessageLabel = {
  messageIndex: number;
  label: string;
  sublabel?: string;
  isSellMessage: boolean;
};

type StoryArc = {
  messageLabels: MessageLabel[];
};

type Props = {
  messages: Message[];
  storyArcs?: StoryArc[];
  autoScrollToFirstSell?: boolean;
};

// Badge color mapping
const LABEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  STORY_START: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
  STORY_END: { bg: "bg-purple-500/15", text: "text-purple-300/70", border: "border-purple-500/20" },
  BUYING_SIGNAL: { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/30" },
  FAN_INVESTED: { bg: "bg-emerald-500/15", text: "text-emerald-300/80", border: "border-emerald-500/20" },
  SELL: { bg: "bg-orange-500/25", text: "text-orange-300", border: "border-orange-500/40" },
  SOFT_SELL: { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/30" },
  EMOTIONAL_HOOK: { bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/30" },
  PEAK_ENGAGEMENT: { bg: "bg-cyan-500/15", text: "text-cyan-300/80", border: "border-cyan-500/20" },
  VISUAL_SETUP: { bg: "bg-white/[0.08]", text: "text-white/50", border: "border-white/10" },
  SENSORY_PACING: { bg: "bg-white/[0.06]", text: "text-white/40", border: "border-white/8" },
};

function getDefaultColor() {
  return { bg: "bg-white/[0.06]", text: "text-white/40", border: "border-white/10" };
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
  } catch {
    return "";
  }
}

/**
 * Enhanced chat bubble viewer with AI-labeled message badges.
 * Designed to render inside a PhoneFrame.
 */
export function StoryChatBubbles({ messages, storyArcs = [], autoScrollToFirstSell = true }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstSellRef = useRef<HTMLDivElement>(null);

  // Build a map of messageIndex → labels
  const labelMap = new Map<number, MessageLabel[]>();
  for (const arc of storyArcs) {
    if (!arc.messageLabels) continue;
    for (const label of arc.messageLabels) {
      const existing = labelMap.get(label.messageIndex) || [];
      existing.push(label);
      labelMap.set(label.messageIndex, existing);
    }
  }

  // Find first sell index
  const firstSellIndex = storyArcs
    .flatMap((a) => a.messageLabels || [])
    .find((l) => l.label?.includes("SELL") && l.isSellMessage)?.messageIndex;

  useEffect(() => {
    if (autoScrollToFirstSell && firstSellRef.current) {
      firstSellRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [autoScrollToFirstSell, firstSellIndex]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 text-xs">
        No messages
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-1.5">
      {messages.map((msg, i) => {
        const labels = labelMap.get(i) || [];
        const isSell = labels.some((l) => l.isSellMessage);
        const isFirstSell = i === firstSellIndex;

        return (
          <div key={i} ref={isFirstSell ? firstSellRef : undefined}>
            {/* Label badges above the bubble */}
            {labels.length > 0 && (
              <div className={`flex flex-wrap gap-1 mb-1 ${msg.isChatter ? "justify-end" : "justify-start"}`}>
                {labels.map((l, li) => {
                  const baseLabel = l.label?.replace(/ #\d+/, "") || "";
                  const colors = LABEL_COLORS[baseLabel] || getDefaultColor();
                  return (
                    <div key={li} className="flex flex-col items-start">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        {l.label}
                      </span>
                      {l.sublabel && (
                        <span className="text-[7px] text-white/25 mt-0.5 pl-1">{l.sublabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Message bubble */}
            <div className={`flex ${msg.isChatter ? "justify-end" : "justify-start"}`}>
              {/* Message number */}
              <div className={`flex items-end gap-1 max-w-[88%] ${msg.isChatter ? "flex-row-reverse" : "flex-row"}`}>
                <span className="text-[8px] text-white/15 tabular-nums shrink-0 mb-1">
                  #{i}
                </span>
                <div
                  className={`rounded-2xl px-3 py-2 ${
                    isSell
                      ? "bg-gradient-to-r from-orange-500/20 to-amber-500/15 border border-orange-500/30 rounded-br-md"
                      : msg.isChatter
                        ? "bg-purple-600/20 border border-purple-500/20 rounded-br-md"
                        : "bg-[#1f1f1f] border border-white/[0.06] rounded-bl-md"
                  }`}
                >
                  <p
                    className={`text-[11px] leading-relaxed ${
                      isSell
                        ? "text-orange-100/90"
                        : msg.isChatter
                          ? "text-purple-100/80"
                          : "text-white/60"
                    }`}
                  >
                    {msg.text}
                  </p>
                  <p
                    className={`text-[8px] mt-0.5 ${
                      msg.isChatter ? "text-purple-400/30 text-right" : "text-white/15"
                    }`}
                  >
                    {formatTime(msg.time)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ChatPhoneCard — iPhone-shaped scrollable chat viewer.
 * Shows chatter name, fan ID, model, revenue/purchase badges,
 * and a scrollable feed of ChatBubble messages.
 */

"use client";

import { useRef, useEffect } from "react";
import { DollarSign, ShoppingBag, MessageSquare } from "lucide-react";
import { ChatBubble, type ChatMessage } from "@/components/chatter/ChatBubble";

export type ChatPhoneData = {
  chatId: string;
  chatterName: string;
  fanId: string;
  fanName: string | null;
  modelName: string;
  revenue?: number;
  purchases?: number;
  messages: ChatMessage[];
};

export function ChatPhoneCard({
  data,
  isSelected,
  onSelect,
  compact = false,
}: {
  data: ChatPhoneData;
  isSelected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [data.chatId]);

  const fanLabel = data.fanName || `Fan ${data.fanId}`;
  const msgCount = data.messages.length;

  return (
    <div
      onClick={onSelect}
      className={`flex flex-col rounded-[28px] border-[3px] border-solid overflow-hidden transition-all ${
        isSelected
          ? "border-purple-500/50 shadow-lg shadow-purple-500/10"
          : "border-white/10 hover:border-white/20"
      } ${onSelect ? "cursor-pointer" : ""} ${compact ? "w-[280px]" : "w-[340px]"} bg-[#0a0a0a]`}
    >
      {/* Phone notch / header */}
      <div className="bg-[#111] px-4 pt-4 pb-3 border-b border-solid border-white/5">
        {/* Notch */}
        <div className="w-20 h-1 rounded-full bg-white/10 mx-auto mb-3" />

        <p className="text-white font-semibold text-sm text-center truncate">
          {data.chatterName}
        </p>
        <p className="text-white/40 text-[11px] text-center mt-0.5 truncate">
          Fan: {fanLabel} ({data.fanId}) → Model: {data.modelName}
        </p>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2 mt-2.5">
          {data.revenue != null && data.revenue > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-solid border-emerald-500/25">
              <DollarSign size={9} />
              ${data.revenue}
            </span>
          )}
          {data.purchases != null && data.purchases > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full border border-solid border-purple-500/25">
              <ShoppingBag size={9} />
              {data.purchases} purchases
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-white/30 px-2 py-0.5 rounded-full bg-white/5">
            <MessageSquare size={9} />
            {msgCount} msgs
          </span>
        </div>
      </div>

      {/* Scrollable chat area */}
      <div
        ref={scrollRef}
        className={`overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-white/10 ${
          compact ? "h-[360px]" : "h-[480px]"
        }`}
      >
        {data.messages.map((msg, i) => (
          <ChatBubble key={msg.id || i} msg={msg} index={i + 1} />
        ))}

        {msgCount === 0 && (
          <p className="text-white/20 text-xs text-center mt-8">No messages in window</p>
        )}
      </div>

      {/* Bottom bar */}
      <div className="h-5 bg-[#111] border-t border-solid border-white/5 flex items-center justify-center">
        <div className="w-24 h-1 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, User, MessageCircle } from "lucide-react";

type Message = { text: string; isChatter: boolean; time: string };
type Conversation = { chatId: string; fanName: string; messages: Message[] };

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  } catch { return ""; }
}

function ChatBubble({ msg }: { msg: Message }) {
  return (
    <div className={`flex ${msg.isChatter ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
        msg.isChatter
          ? "bg-teal-500/15 border border-teal-500/20 rounded-br-md"
          : "bg-white/[0.06] border border-white/10 rounded-bl-md"
      }`}>
        <p className={`text-[13px] leading-relaxed ${msg.isChatter ? "text-teal-100/90" : "text-white/70"}`}>
          {msg.text}
        </p>
        <p className={`text-[9px] mt-1 ${msg.isChatter ? "text-teal-400/40 text-right" : "text-white/20"}`}>
          {formatTime(msg.time)}
        </p>
      </div>
    </div>
  );
}

export function ChatBubbleViewer({ conversations }: { conversations: Conversation[] }) {
  const [index, setIndex] = useState(0);

  if (conversations.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-white/30 text-sm">
        <MessageCircle size={16} className="mr-2 opacity-50" /> No conversation data stored yet
      </div>
    );
  }

  const convo = conversations[index];

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
            <User size={12} className="text-purple-400" />
          </div>
          <div>
            <span className="text-white text-sm font-medium">{convo.fanName}</span>
            <span className="text-white/20 text-xs ml-2">{convo.messages.length} messages</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="glass-button rounded-lg p-1.5 text-white/30 hover:text-white disabled:opacity-20"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-white/30 text-xs tabular-nums px-1">
            {index + 1}/{conversations.length}
          </span>
          <button
            onClick={() => setIndex(Math.min(conversations.length - 1, index + 1))}
            disabled={index === conversations.length - 1}
            className="glass-button rounded-lg p-1.5 text-white/30 hover:text-white disabled:opacity-20"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Chat Bubbles */}
      <div className="glass-inset rounded-2xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-0.5">
        {convo.messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20" />
          <span className="text-[10px] text-white/30">Fan</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-500/20 border border-teal-500/30" />
          <span className="text-[10px] text-white/30">Chatter</span>
        </div>
      </div>
    </div>
  );
}

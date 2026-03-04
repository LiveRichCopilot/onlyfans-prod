/**
 * StoryBreakdownPanel — Right-side analysis panel for a conversation.
 * Shows story length, sells within story, story flow analysis,
 * fan investment level, key elements, and selling pattern checklist.
 */

import { MessageSquare, TrendingUp, Heart, Zap, CheckCircle } from "lucide-react";
import type { ChatMessage } from "@/components/chatter/ChatBubble";

export type StoryAnalysis = {
  title: string;
  msgRange: string;
  messageCount: number;
  sells: Array<{
    msgIndex: number;
    text: string;
    type: string;
  }>;
  storyFlow: string;
  fanInvestment: string;
  keyElements: string[];
  sellingPattern: string[];
};

function SectionHeader({ label }: { label: string }) {
  return (
    <span className="text-white/30 text-[10px] uppercase tracking-wider font-medium block mb-1.5">
      {label}
    </span>
  );
}

export function StoryBreakdownPanel({
  analysis,
  messages,
}: {
  analysis: StoryAnalysis;
  messages: ChatMessage[];
}) {
  const totalSells = analysis.sells.length;

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#0d0d0d] rounded-2xl border border-solid border-white/8 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10">
      {/* Title */}
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        📊 {analysis.title}
      </h3>

      {/* Story Length */}
      <div>
        <SectionHeader label="Story Length" />
        <p className="text-white/80 text-sm">
          <span className="font-semibold text-white">{analysis.messageCount} messages</span>
          <span className="text-white/40"> — {analysis.msgRange}</span>
        </p>
      </div>

      {/* Sells Within Story */}
      <div>
        <SectionHeader label="Sells Within Story" />
        <p className="text-white/80 text-sm font-semibold mb-1.5">
          {totalSells} sell{totalSells !== 1 ? "s" : ""}
        </p>
        {analysis.sells.map((sell, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-white/60 mb-1">
            <span className="text-white/30 shrink-0">#{sell.msgIndex}:</span>
            <span className="italic">&ldquo;{sell.text.slice(0, 100)}&rdquo;</span>
          </div>
        ))}
      </div>

      {/* Story Flow */}
      <div>
        <SectionHeader label="Story Flow Maintained" />
        <p className="text-white/70 text-sm leading-relaxed">{analysis.storyFlow}</p>
      </div>

      {/* Fan Investment */}
      <div>
        <SectionHeader label="Fan Investment" />
        <p className="text-white/70 text-sm leading-relaxed">{analysis.fanInvestment}</p>
      </div>

      {/* Key Story Elements */}
      {analysis.keyElements.length > 0 && (
        <div>
          <SectionHeader label="Key Story Elements" />
          <ul className="space-y-1">
            {analysis.keyElements.map((el, i) => (
              <li key={i} className="text-white/60 text-sm flex items-start gap-1.5">
                <span className="text-white/30 mt-0.5 shrink-0">•</span>
                {el}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selling Pattern Checklist */}
      {analysis.sellingPattern.length > 0 && (
        <div className="p-4 rounded-xl border border-solid border-white/8 bg-white/[0.02]">
          <p className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            🎯 Selling Pattern
          </p>
          <ul className="space-y-2">
            {analysis.sellingPattern.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-white/70">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

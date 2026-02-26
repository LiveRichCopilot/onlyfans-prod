"use client";

import { ReactNode } from "react";

type PhoneFrameProps = {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
};

/**
 * CSS-only iPhone mockup container with Dynamic Island notch.
 * Fixed width ~300px, scrollable content area inside.
 */
export function PhoneFrame({ children, header, className = "" }: PhoneFrameProps) {
  return (
    <div className={`relative flex flex-col w-[300px] shrink-0 ${className}`}>
      {/* Outer bezel */}
      <div className="relative rounded-[40px] border-[6px] border-[#1a1a1a] bg-black shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden flex flex-col h-[580px]">
        {/* Dynamic Island */}
        <div className="flex justify-center pt-2.5 pb-1 bg-black">
          <div className="w-[90px] h-[26px] bg-[#0a0a0a] rounded-full border border-white/[0.04]" />
        </div>

        {/* Header bar */}
        {header && (
          <div className="px-4 py-2 border-b border-white/[0.06] bg-black/60 backdrop-blur-sm shrink-0">
            {header}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-3 bg-[#0c0c0c]">
          {children}
        </div>

        {/* Home indicator */}
        <div className="flex justify-center pb-2 pt-1.5 bg-black">
          <div className="w-[100px] h-[4px] bg-white/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Mini phone thumbnail for the gallery grid. Clickable, shows summary info.
 */
export function MiniPhone({
  chatterName,
  fanName,
  score,
  messageCount,
  isSelected,
  onClick,
}: {
  chatterName: string;
  fanName: string;
  score: number;
  messageCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = score >= 80 ? "#34D399" : score >= 60 ? "#2DD4BF" : score >= 40 ? "#FBBF24" : "#F87171";

  return (
    <button
      onClick={onClick}
      className={`relative w-[130px] rounded-[20px] border-[3px] transition-all duration-200 overflow-hidden flex flex-col ${
        isSelected
          ? "border-teal-400/60 shadow-[0_0_20px_rgba(45,212,191,0.15)] scale-[1.02]"
          : "border-[#1a1a1a] hover:border-white/20 hover:scale-[1.01]"
      }`}
    >
      {/* Mini Dynamic Island */}
      <div className="flex justify-center pt-1.5 bg-black">
        <div className="w-[40px] h-[10px] bg-[#0a0a0a] rounded-full" />
      </div>

      {/* Content */}
      <div className="bg-[#0c0c0c] px-2.5 py-3 flex-1 flex flex-col items-center gap-1.5 min-h-[100px]">
        {/* Score badge */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: `${color}15`, border: `1.5px solid ${color}40`, color }}
        >
          {score}
        </div>

        <div className="text-center">
          <p className="text-white/80 text-[10px] font-medium truncate w-full">{chatterName}</p>
          <p className="text-white/30 text-[9px] truncate w-full">{fanName}</p>
        </div>

        <span className="text-white/20 text-[9px]">{messageCount} msgs</span>
      </div>

      {/* Mini home bar */}
      <div className="flex justify-center pb-1.5 bg-black">
        <div className="w-[40px] h-[2px] bg-white/10 rounded-full" />
      </div>
    </button>
  );
}

/**
 * ChatBubble — Single message bubble inside a phone card.
 * Fan messages = dark/left, Chatter messages = colored/right.
 * PPV messages get a green highlight with $ amount.
 */

export type StoryLabelType =
  | "STORY_START"
  | "BUYING_SIGNAL"
  | "SELL"
  | "EMOTIONAL_HOOK"
  | "PEAK_ENGAGEMENT"
  | "VISUAL_SETUP"
  | "SENSORY_PACING"
  | "FAN_INVESTED"
  | "STORY_END"
  | "MISSED_CUE"
  | "COPY_PASTE"
  | "LAZY_REPLY";

export type ChatMessage = {
  id: string | null;
  text: string;
  isChatter: boolean;
  createdAt: string;
  price?: number;
  label?: {
    text: string;
    type: StoryLabelType;
  };
};

const LABEL_STYLES: Record<string, string> = {
  STORY_START: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  BUYING_SIGNAL: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  SELL: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  EMOTIONAL_HOOK: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  PEAK_ENGAGEMENT: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  VISUAL_SETUP: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  SENSORY_PACING: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  FAN_INVESTED: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  STORY_END: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  MISSED_CUE: "bg-red-500/20 text-red-300 border-red-500/30",
  COPY_PASTE: "bg-red-500/20 text-red-300 border-red-500/30",
  LAZY_REPLY: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

export function ChatBubble({ msg, index }: { msg: ChatMessage; index: number }) {
  const isChatter = msg.isChatter;
  const time = msg.createdAt ? msg.createdAt.slice(11, 19) : "";
  const hasPPV = msg.price && msg.price > 0;

  return (
    <div className={`flex flex-col ${isChatter ? "items-end" : "items-start"} mb-2`}>
      {/* Story label tag */}
      {msg.label && (
        <div
          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-solid mb-1 ${LABEL_STYLES[msg.label.type] || LABEL_STYLES.STORY_START}`}
        >
          {msg.label.text}
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-[18px] px-3 py-2 text-[13px] leading-relaxed ${
          isChatter
            ? hasPPV
              ? "bg-emerald-600/80 text-white rounded-br-[4px]"
              : "bg-purple-600/60 text-white rounded-br-[4px]"
            : "bg-[#1f1f1f] text-white/90 rounded-bl-[4px] border border-solid border-white/[0.06]"
        }`}
      >
        {hasPPV && (
          <span className="text-[10px] font-bold text-emerald-200 block mb-0.5">
            💰 ${msg.price}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
      </div>

      {/* Timestamp + index */}
      <span className={`text-[9px] text-white/20 mt-0.5 px-1 ${isChatter ? "text-right" : "text-left"}`}>
        {time}
        {index > 0 && <span className="ml-1.5">#{index}</span>}
      </span>
    </div>
  );
}

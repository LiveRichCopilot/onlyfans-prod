"use client";

import { useState } from "react";
import { Clock, AppWindow, ChevronDown, ChevronUp, MessageSquare, Quote } from "lucide-react";

type NotableQuote = { text: string; type: "great" | "good" | "bad" | "ugly"; context?: string };
type ConvoMessage = { text: string; isChatter: boolean; time: string };
type ConvoChat = { chatId: string; fanName: string; messages: ConvoMessage[] };

type HourlyEntry = {
  windowStart: string;
  windowEnd: string;
  totalScore: number;
  messagesAnalyzed: number;
  conversationsScanned: number;
  archetype: string | null;
  aiNotes: string | null;
  notableQuotes?: NotableQuote[] | null;
  conversationData?: ConvoChat[] | null;
  scores?: { sla: number; followup: number; trigger: number; quality: number; revenue: number };
  strengthTags?: string[];
  mistakeTags?: string[];
};

const COLLAPSED_COUNT = 4;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function activityColor(pct: number): string {
  if (pct >= 60) return "#34d399";
  if (pct >= 30) return "#fbbf24";
  return "#f87171";
}

const quoteColor: Record<string, string> = { great: "#34d399", good: "#2dd4bf", bad: "#fbbf24", ugly: "#f87171" };

/** Extract conversation array — handles both plain array and {conversations:[...]} wrapper */
function getConversations(data: any): ConvoChat[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.conversations && Array.isArray(data.conversations)) return data.conversations;
  return [];
}

/** Hourly performance timeline — collapsible, click to see conversations */
export function HourlyTimeline({ timeline }: { timeline: HourlyEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (timeline.length === 0) return null;

  const visible = expanded ? timeline : timeline.slice(0, COLLAPSED_COUNT);
  const showToggle = timeline.length > COLLAPSED_COUNT;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <Clock size={12} className="text-teal-400" /> Hourly Performance
        <span className="text-[10px] text-white/30 font-normal ml-1">Click a row to see evidence</span>
      </h4>
      <div className="space-y-1">
        {visible.map((h, i) => {
          const isOpen = openIndex === i;
          const convos = getConversations(h.conversationData);
          const hasEvidence = h.aiNotes || (h.notableQuotes && (h.notableQuotes as NotableQuote[]).length > 0) || convos.length > 0;
          return (
            <div key={i}>
              {/* Score bar row — clickable */}
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className={`w-full flex items-center gap-2 py-1 rounded-lg transition ${hasEvidence ? "hover:bg-white/5 cursor-pointer" : "cursor-default"}`}
              >
                <span className="text-[10px] text-white/60 w-14 shrink-0 tabular-nums text-left">
                  {formatTime(h.windowStart)}
                </span>
                <div className="flex-1 h-5 glass-inset rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all"
                    style={{ width: `${h.totalScore}%`, background: activityColor(h.totalScore) }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80">
                    {h.totalScore}
                  </span>
                </div>
                <span className="text-[9px] text-white/50 w-12 shrink-0 text-right">{h.messagesAnalyzed} msgs</span>
                {hasEvidence && (
                  <span className="text-white/30 shrink-0">
                    {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </span>
                )}
              </button>

              {/* Expanded evidence panel */}
              {isOpen && hasEvidence && (
                <div className="ml-14 mr-2 mb-2 mt-1 space-y-2 border-l-2 border-white/10 pl-3">
                  {/* AI notes */}
                  {h.aiNotes && (
                    <p className="text-[11px] text-white/60 leading-relaxed">{h.aiNotes}</p>
                  )}

                  {/* Per-hour score breakdown */}
                  {h.scores && (
                    <div className="flex items-center gap-2 flex-wrap text-[9px]">
                      <span className="text-blue-400">SLA {h.scores.sla}/25</span>
                      <span className="text-teal-400">Follow {h.scores.followup}/20</span>
                      <span className="text-purple-400">Trigger {h.scores.trigger}/20</span>
                      <span className="text-amber-400">Quality {h.scores.quality}/20</span>
                      <span className="text-emerald-400">Rev {h.scores.revenue}/15</span>
                    </div>
                  )}

                  {/* Tags for this hour */}
                  {((h.strengthTags && h.strengthTags.length > 0) || (h.mistakeTags && h.mistakeTags.length > 0)) && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {h.strengthTags?.map((t, j) => (
                        <span key={`s${j}`} className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400/80 border border-teal-500/15">{t}</span>
                      ))}
                      {h.mistakeTags?.map((t, j) => (
                        <span key={`m${j}`} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/80 border border-red-500/15">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Notable quotes */}
                  {h.notableQuotes && (h.notableQuotes as NotableQuote[]).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-white/40 font-medium flex items-center gap-1">
                        <Quote size={9} /> Notable Messages
                      </div>
                      {(h.notableQuotes as NotableQuote[]).map((q, j) => (
                        <div key={j} className="rounded-lg px-2.5 py-1.5 border" style={{
                          borderColor: `${quoteColor[q.type] || "#666"}30`,
                          background: `${quoteColor[q.type] || "#666"}08`,
                        }}>
                          <p className="text-[10px] text-white/70 leading-relaxed italic">"{q.text}"</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold uppercase" style={{ color: quoteColor[q.type] || "#666" }}>{q.type}</span>
                            {q.context && <span className="text-[9px] text-white/30">{q.context}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Conversation thread */}
                  {convos.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[9px] text-white/40 font-medium flex items-center gap-1">
                        <MessageSquare size={9} /> Conversations Scored
                      </div>
                      {convos.slice(0, 3).map((chat, ci) => (
                        <div key={ci} className="space-y-0.5">
                          <div className="text-[9px] text-white/50 font-medium">Fan: {chat.fanName || "Unknown"}</div>
                          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                            {chat.messages.slice(0, 15).map((msg, mi) => (
                              <div key={mi} className={`text-[10px] leading-relaxed px-2 py-0.5 rounded ${
                                msg.isChatter
                                  ? "bg-teal-500/8 text-white/70 ml-4"
                                  : "bg-white/5 text-white/50 mr-4"
                              }`}>
                                <span className="text-[8px] text-white/30 mr-1">{formatTime(msg.time)}</span>
                                {msg.text}
                              </div>
                            ))}
                            {chat.messages.length > 15 && (
                              <div className="text-[9px] text-white/25 text-center py-0.5">+{chat.messages.length - 15} more messages</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {convos.length > 3 && (
                        <div className="text-[9px] text-white/25 text-center">+{convos.length - 3} more chats</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showToggle && (
        <button
          onClick={() => { setExpanded(!expanded); if (expanded) setOpenIndex(null); }}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-white/40 hover:text-white/70 transition"
        >
          {expanded ? <><ChevronUp size={14} /> Show top {COLLAPSED_COUNT}</> : <><ChevronDown size={14} /> Show all {timeline.length} windows</>}
        </button>
      )}
    </div>
  );
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Top apps used during shift */
export function TopAppsSection({ apps }: { apps: { name: string; seconds: number; pct: number }[] }) {
  if (apps.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
        <AppWindow size={12} className="text-teal-400" /> Top Apps During Shift
      </h4>
      <div className="space-y-1.5">
        {apps.map((app, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-white/80 w-28 truncate">{app.name}</span>
            <div className="flex-1 h-1.5 glass-inset rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-teal-400/60" style={{ width: `${app.pct}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-white/70 w-10 text-right">{app.pct}%</span>
            <span className="text-[10px] tabular-nums text-white/50 w-12 text-right">{formatSeconds(app.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Strength and mistake tags */
export function TagsSection({ strengths, mistakes }: { strengths: string[]; mistakes: string[] }) {
  if (strengths.length === 0 && mistakes.length === 0) return null;

  return (
    <div className="glass-inset rounded-2xl p-4 space-y-3">
      <h4 className="text-white/70 text-xs font-semibold">Tags</h4>
      {strengths.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {strengths.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-teal-500/15 text-teal-400 border border-teal-500/20">
              {t}
            </span>
          ))}
        </div>
      )}
      {mistakes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mistakes.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

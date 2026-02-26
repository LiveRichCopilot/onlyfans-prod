"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, AlertTriangle, Trophy } from "lucide-react";
import { ExportButtons } from "./ExportButtons";
import { scoreColor } from "./chart-colors";

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
  mistakeTags: string[];
  strengthTags: string[];
  penalties: { copyPaste: number; missedTrigger: number; spam: number };
};

function formatTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 glass-inset rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: scoreColor(pct) }} />
      </div>
      <span className="text-[10px] text-white/30 tabular-nums w-8 text-right">{score}/{max}</span>
    </div>
  );
}

function ConversationCard({ sample }: { sample: ConversationSample }) {
  const [open, setOpen] = useState(false);
  const quotes = Array.isArray(sample.notableQuotes) ? sample.notableQuotes : [];
  const hasPenalties = sample.penalties.copyPaste < 0 || sample.penalties.missedTrigger < 0 || sample.penalties.spam < 0;

  return (
    <div className="glass-inset rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${scoreColor(sample.totalScore)}15`, border: `1px solid ${scoreColor(sample.totalScore)}30` }}>
          <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(sample.totalScore) }}>{sample.totalScore}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate">{sample.chatterName}</span>
            <span className="text-white/20">→</span>
            <span className="text-white/50 text-sm truncate">{sample.creator}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-white/30 text-[10px]">{new Date(sample.date).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            {sample.archetype && <span className="text-purple-400/60 text-[10px] bg-purple-500/10 px-1.5 py-0.5 rounded">{formatTag(sample.archetype)}</span>}
            {hasPenalties && <AlertTriangle size={11} className="text-red-400/60" />}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {/* Score Bars */}
          <div className="space-y-1.5">
            <ScoreBar label="SLA" score={sample.slaScore} max={25} />
            <ScoreBar label="Follow-up" score={sample.followupScore} max={20} />
            <ScoreBar label="Triggers" score={sample.triggerScore} max={20} />
            <ScoreBar label="Quality" score={sample.qualityScore} max={20} />
            <ScoreBar label="Revenue" score={sample.revenueScore} max={15} />
          </div>

          {/* Penalties */}
          {hasPenalties && (
            <div className="flex gap-2 flex-wrap">
              {sample.penalties.copyPaste < 0 && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Copy/Paste {sample.penalties.copyPaste}</span>}
              {sample.penalties.missedTrigger < 0 && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Missed Trigger {sample.penalties.missedTrigger}</span>}
              {sample.penalties.spam < 0 && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Spam {sample.penalties.spam}</span>}
            </div>
          )}

          {/* Tags */}
          {(sample.strengthTags.length > 0 || sample.mistakeTags.length > 0) && (
            <div className="flex gap-1.5 flex-wrap">
              {sample.strengthTags.map(t => <span key={t} className="text-[9px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full">{formatTag(t)}</span>)}
              {sample.mistakeTags.map(t => <span key={t} className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">{formatTag(t)}</span>)}
            </div>
          )}

          {/* AI Notes */}
          {sample.aiNotes && (
            <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
              <p className="text-white/50 text-[11px] leading-relaxed">{sample.aiNotes}</p>
            </div>
          )}

          {/* Notable Quotes */}
          {quotes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Notable Lines</p>
              {quotes.map((q: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <MessageCircle size={11} className={q.quality === "great" || q.quality === "good" ? "text-teal-400/50" : "text-red-400/50"} />
                  <p className="text-white/40 text-[11px] italic leading-relaxed">&ldquo;{q.text || q}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConversationScoringSection({ data }: { data: ConversationSample[] }) {
  const exportData = data.map(d => ({
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

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" /> Conversation Scoring
          </h3>
          <p className="text-white/40 text-xs mt-0.5">Recent scored conversations with AI analysis</p>
        </div>
        <ExportButtons data={exportData} filename="conversation-scoring" />
      </div>
      {data.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-white/30 text-sm">No scored conversations yet</div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {data.map((sample, i) => <ConversationCard key={i} sample={sample} />)}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ExportButtons } from "./ExportButtons";

type TagEntry = { tag: string; count: number; chatters?: string[] };
type Props = {
  data: { strengths: TagEntry[]; weaknesses: TagEntry[] };
};

const TAG_LABELS: Record<string, string> = {
  good_push_pull: "Push/Pull",
  strong_cta: "Strong CTA",
  adapted_to_fan: "Adapted",
  built_tension: "Tension",
  proactive_followup: "Follow-up",
  used_fan_name: "Used Name",
  created_urgency: "Urgency",
  good_closer: "Closer",
  persona_switch: "Persona",
  detective_skill: "Detective",
  reframed_refusal: "Reframed",
  emotional_trigger: "Emotional",
  brand_voice: "Brand Voice",
  missed_trigger: "Missed Trigger",
  flat_ack: "Flat Ack",
  no_cta: "No CTA",
  copy_paste: "Copy/Paste",
  too_slow: "Too Slow",
  no_followup: "No Follow-up",
  free_emotional_labor: "Free Labor",
  gave_freebie: "Gave Freebie",
  grammar_fail: "Grammar",
  yes_babe_loop: "Yes Babe Loop",
  killed_momentum: "Killed Momentum",
  too_available: "Too Available",
  no_persona_switch: "No Persona",
  platonic_chatting: "Platonic Chat",
};

const TAG_EXPLANATIONS: Record<string, string> = {
  good_push_pull: "Good at teasing/withdrawing to build desire",
  strong_cta: "Clear call-to-action driving purchases",
  adapted_to_fan: "Adjusted style to match the fan's vibe",
  built_tension: "Built sexual/emotional tension before selling",
  proactive_followup: "Followed up without being asked",
  used_fan_name: "Used the fan's name to personalize",
  created_urgency: "Created FOMO or time pressure",
  good_closer: "Successfully closed a sale",
  persona_switch: "Switched personas to match the fan",
  detective_skill: "Found and used personal details",
  reframed_refusal: "Turned a rejection into a new angle",
  emotional_trigger: "Hit an emotional button that drives spending",
  brand_voice: "Stayed in the creator's voice",
  missed_trigger: "Fan showed buying intent but chatter ignored it",
  flat_ack: "Replied with dead-end responses like 'ok' or 'lol'",
  no_cta: "No attempt to drive a purchase or tip",
  copy_paste: "Sent the same generic message to multiple fans",
  too_slow: "Took too long to respond — fan lost interest",
  no_followup: "Didn't follow up after fan went quiet",
  free_emotional_labor: "Long emotional chat without monetizing",
  gave_freebie: "Gave away content that should have been sold",
  grammar_fail: "Bad grammar that breaks immersion",
  yes_babe_loop: "Repetitive 'yes babe' responses with no substance",
  killed_momentum: "Broke the mood or changed topic at the wrong time",
  too_available: "Always instant — no mystery or anticipation",
  no_persona_switch: "Same flat personality regardless of fan type",
  platonic_chatting: "Friendly chat with zero sales intent",
};

function formatTag(tag: string): string {
  return TAG_LABELS[tag] || tag.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function TagPill({ tag, isStrength }: { tag: TagEntry; isStrength: boolean }) {
  const [showDetail, setShowDetail] = useState(false);
  const explanation = TAG_EXPLANATIONS[tag.tag] || "";
  const names = Array.from(new Set(tag.chatters ?? []));

  const baseClass = isStrength
    ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
    : "bg-red-500/10 text-red-400 border-red-500/20";
  const nameColor = isStrength ? "text-teal-300/60" : "text-red-300/60";

  return (
    <div
      className="relative"
      tabIndex={-1}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowDetail(false);
      }}
    >
      <button
        type="button"
        onClick={() => setShowDetail(v => !v)}
        className={`${baseClass} border rounded-full px-2.5 py-1 text-[11px] transition-all hover:brightness-125`}
      >
        {formatTag(tag.tag)} <span className={`${isStrength ? "text-teal-400/40" : "text-red-400/40"} ml-0.5`}>{tag.count}</span>
      </button>
      {showDetail && (
        <div
          className={`absolute z-20 top-full mt-1 right-0 sm:left-0 sm:right-auto min-w-[200px] max-w-[280px] p-3 rounded-xl border ${
            isStrength ? "border-teal-500/20 bg-[#0a1f1a]" : "border-red-500/20 bg-[#1f0a0a]"
          } shadow-xl`}
        >
          {explanation && <p className="text-white/50 text-[10px] leading-relaxed mb-2">{explanation}</p>}
          {names.length > 0 && (
            <div>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Who</p>
              <div className="flex flex-wrap gap-1">
                {names.map((n, i) => (
                  <span key={`${n}-${i}`} className={`${nameColor} text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded`}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TagCloudPanel({ data }: Props) {
  const allTags = [
    ...data.strengths.map(t => ({ ...t, type: "strength" })),
    ...data.weaknesses.map(t => ({ ...t, type: "weakness" })),
  ];

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Performance Tags</h3>
          <p className="text-white/40 text-xs mt-0.5">Click any tag to see who and why</p>
        </div>
        <ExportButtons data={allTags.map(t => ({ tag: formatTag(t.tag), type: t.type, count: t.count, chatters: t.chatters?.join(" | ") || "" }))} filename="performance-tags" />
      </div>

      {data.strengths.length === 0 && data.weaknesses.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-white/30 text-sm">No tags detected yet</div>
      ) : (
        <div className="space-y-4">
          {data.strengths.length > 0 && (
            <div>
              <p className="text-teal-400/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Strengths — what your chatters are doing right</p>
              <div className="flex flex-wrap gap-1.5">
                {data.strengths.slice(0, 12).map(t => (
                  <TagPill key={t.tag} tag={t} isStrength />
                ))}
              </div>
            </div>
          )}
          {data.weaknesses.length > 0 && (
            <div>
              <p className="text-red-400/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Weaknesses — costing you money</p>
              <div className="flex flex-wrap gap-1.5">
                {data.weaknesses.slice(0, 12).map(t => (
                  <TagPill key={t.tag} tag={t} isStrength={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

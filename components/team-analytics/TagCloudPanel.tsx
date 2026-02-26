"use client";

import { ExportButtons } from "./ExportButtons";

type TagEntry = { tag: string; count: number };
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

function formatTag(tag: string): string {
  return TAG_LABELS[tag] || tag.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function TagCloudPanel({ data }: Props) {
  const maxStrength = Math.max(1, ...data.strengths.map(t => t.count));
  const maxWeakness = Math.max(1, ...data.weaknesses.map(t => t.count));

  const allTags = [
    ...data.strengths.map(t => ({ ...t, type: "strength" })),
    ...data.weaknesses.map(t => ({ ...t, type: "weakness" })),
  ];

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Performance Tags</h3>
          <p className="text-white/40 text-xs mt-0.5">Strengths & weaknesses detected</p>
        </div>
        <ExportButtons data={allTags.map(t => ({ tag: formatTag(t.tag), type: t.type, count: t.count }))} filename="performance-tags" />
      </div>

      {data.strengths.length === 0 && data.weaknesses.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-white/30 text-sm">No tags detected yet</div>
      ) : (
        <div className="space-y-4">
          {data.strengths.length > 0 && (
            <div>
              <p className="text-teal-400/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {data.strengths.slice(0, 12).map(t => {
                  const scale = 0.7 + (t.count / maxStrength) * 0.6;
                  return (
                    <span key={t.tag} className="bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full px-2.5 py-1 transition-all" style={{ fontSize: `${Math.round(scale * 11)}px` }}>
                      {formatTag(t.tag)} <span className="text-teal-400/40 ml-0.5">{t.count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {data.weaknesses.length > 0 && (
            <div>
              <p className="text-red-400/70 text-[10px] font-semibold uppercase tracking-wider mb-2">Weaknesses</p>
              <div className="flex flex-wrap gap-1.5">
                {data.weaknesses.slice(0, 12).map(t => {
                  const scale = 0.7 + (t.count / maxWeakness) * 0.6;
                  return (
                    <span key={t.tag} className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2.5 py-1 transition-all" style={{ fontSize: `${Math.round(scale * 11)}px` }}>
                      {formatTag(t.tag)} <span className="text-red-400/40 ml-0.5">{t.count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

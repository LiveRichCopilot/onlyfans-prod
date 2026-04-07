"use client";

import type { Pattern } from "./ContentPlan";

export function PatternsWereMissing({ patterns }: { patterns: Pattern[] }) {
  if (patterns.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Patterns We're Noticing
      </div>
      <div className="glass-panel rounded-2xl border border-white/10 divide-y divide-white/5">
        {patterns.map((p, i) => (
          <div key={i} className="p-5">
            <div className="flex items-start gap-4">
              <div className="text-[10px] text-teal-300 font-bold uppercase tracking-widest mt-1 min-w-[72px]">
                #{i + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white mb-1">{p.title}</div>
                <div className="text-xs text-white/60 leading-relaxed">{p.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-white/40 mt-2">
        Observations pulled from the last 14 days of your paid masses. If a pattern doesn't match what you're seeing, tell Jay and we'll refine the rules.
      </div>
    </div>
  );
}

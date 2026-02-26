"use client";

import { AlertTriangle, Copy, Users } from "lucide-react";
import { ExportButtons } from "./ExportButtons";

type Blast = { message: string; fanCount: number };
type ChatterBlasts = {
  chatterName: string;
  chatterEmail: string;
  creator: string;
  totalBlastSends: number;
  uniqueBlasts: number;
  blasts: Blast[];
};

function getSeverity(totalBlasts: number): { label: string; color: string; bg: string; border: string } {
  if (totalBlasts >= 50) return { label: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };
  if (totalBlasts >= 20) return { label: "WARNING", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  if (totalBlasts >= 10) return { label: "MODERATE", color: "text-orange-400/70", bg: "bg-orange-500/8", border: "border-orange-500/15" };
  return { label: "MINOR", color: "text-yellow-400/60", bg: "bg-yellow-500/5", border: "border-yellow-500/10" };
}

function BlasterCard({ data }: { data: ChatterBlasts }) {
  const severity = getSeverity(data.totalBlastSends);
  return (
    <div className={`glass-inset rounded-2xl p-4 ${severity.border} border`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">{data.chatterName}</span>
          <span className="text-white/30 text-xs">→ {data.creator}</span>
        </div>
        <span className={`${severity.color} ${severity.bg} text-[10px] font-bold px-2 py-0.5 rounded-full ${severity.border} border`}>
          {severity.label}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-white/40">
        <span>Unique blasts: <span className="text-white/60 font-medium">{data.uniqueBlasts}</span></span>
        <span>Total sends: <span className="text-white/60 font-medium">{data.totalBlastSends}</span></span>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">Top copy-pasted messages:</p>
        {data.blasts.slice(0, 5).map((blast, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <Users size={10} className="text-white/20" />
              <span className="text-white/40 text-[10px] tabular-nums font-medium">{blast.fanCount} fans</span>
            </div>
            <p className="text-white/50 text-[11px] leading-relaxed italic">
              &ldquo;{blast.message.length > 200 ? blast.message.slice(0, 200) + "..." : blast.message}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CopyPasteBlasting({ data }: { data: ChatterBlasts[] }) {
  const sorted = [...data].sort((a, b) => b.totalBlastSends - a.totalBlastSends);

  const exportData = sorted.flatMap(c =>
    c.blasts.map(b => ({
      chatter: c.chatterName,
      creator: c.creator,
      fanCount: b.fanCount,
      message: b.message,
    }))
  );

  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" /> Mass Copy-Paste Blasting
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Chatters sending the exact same message to multiple fans
          </p>
        </div>
        <ExportButtons data={exportData} filename="copy-paste-blasts" />
      </div>

      {sorted.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center text-white/30 text-sm">
          <Copy size={14} className="mr-2 opacity-50" /> No copy-paste blasting detected
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
          {sorted.map((chatter, i) => <BlasterCard key={i} data={chatter} />)}
        </div>
      )}
    </div>
  );
}

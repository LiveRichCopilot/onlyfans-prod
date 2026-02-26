"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, DollarSign, Eye, ShoppingCart, Send, Megaphone } from "lucide-react";
import { ContentMessageCard } from "./ContentMessageCard";
import type { MessageCardData } from "./ContentMessageCard";

type AggEntry = {
  name: string; count: number; sentCount: number; viewedCount: number;
  purchasedCount: number; conversionRate: number; viewRate: number;
  purchaseRate: number; totalRevenue: number; avgPrice: number;
  rpm: number; ctaRate: number;
};

type CreatorSummary = AggEntry & {
  messages: MessageCardData[];
  bestHook: string;
  topMediaType: string;
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function CreatorCard({ creator, expanded, onToggle }: {
  creator: CreatorSummary; expanded: boolean; onToggle: () => void;
}) {
  const topMsg = creator.messages[0];
  return (
    <div className="glass-inset rounded-xl overflow-hidden">
      {/* Summary row — always visible */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.02] transition">
        {/* Thumbnail preview from top message */}
        {topMsg?.thumbnails?.[0] ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
            <img src={`/api/proxy-media?url=${encodeURIComponent(topMsg.thumbnails[0].url)}`} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-white/5 shrink-0 flex items-center justify-center text-white/20 text-xs font-bold">
            {creator.name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{creator.name}</p>
          <p className="text-white/30 text-[10px]">
            {creator.count} msgs — best hook: <span className="text-white/50 capitalize">{creator.bestHook.replace(/_/g, " ")}</span>
          </p>
        </div>

        {/* Key stats */}
        <div className="hidden sm:flex items-center gap-4 text-[10px] text-white/40 shrink-0">
          <span className="flex items-center gap-1"><Send size={9} /> <span className="text-white/60 font-medium">{fmtNum(creator.sentCount)}</span></span>
          <span className="flex items-center gap-1"><Eye size={9} /> <span className="text-white/60 font-medium">{fmtNum(creator.viewedCount)}</span> <span className="text-white/30">({creator.viewRate}%)</span></span>
          <span className="flex items-center gap-1"><ShoppingCart size={9} /> <span className="text-white/60 font-medium">{fmtNum(creator.purchasedCount)}</span> <span className="text-white/30">({creator.conversionRate}%)</span></span>
        </div>

        <div className="text-right shrink-0 w-20">
          <p className="text-teal-400 font-bold text-sm">${creator.totalRevenue.toFixed(0)}</p>
          {creator.rpm > 0 && <p className="text-white/25 text-[9px]">${creator.rpm.toFixed(2)} RPM</p>}
        </div>

        <div className="shrink-0 text-white/20">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded: show messages */}
      {expanded && (
        <div className="border-t border-white/5 p-3 space-y-2">
          {/* Mobile stats */}
          <div className="sm:hidden flex items-center gap-4 text-[10px] text-white/40 mb-2 flex-wrap">
            <span>Sent: <span className="text-white/60 font-medium">{fmtNum(creator.sentCount)}</span></span>
            <span>Viewed: <span className="text-white/60 font-medium">{fmtNum(creator.viewedCount)}</span> ({creator.viewRate}%)</span>
            <span>Purchased: <span className="text-white/60 font-medium">{fmtNum(creator.purchasedCount)}</span> ({creator.conversionRate}%)</span>
          </div>

          {creator.messages.length === 0 ? (
            <p className="text-white/20 text-xs text-center py-4">No messages in this period</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
              {creator.messages.map((m, i) => (
                <ContentMessageCard key={m.id} msg={m} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ContentCreatorTab({
  creatorPerformance, allDirect, allMass,
}: {
  creatorPerformance: AggEntry[];
  allDirect: MessageCardData[];
  allMass: MessageCardData[];
}) {
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"revenue" | "count" | "cvr">("revenue");

  const creators = useMemo(() => {
    const allMessages = [...allDirect, ...allMass];
    return creatorPerformance.map(agg => {
      const msgs = allMessages
        .filter(m => m.creatorName === agg.name)
        .sort((a, b) => (b.purchasedCount * b.price) - (a.purchasedCount * a.price));

      // Find best hook for this creator
      const hookCounts = new Map<string, number>();
      for (const m of msgs) {
        if (m.purchasedCount > 0) {
          hookCounts.set(m.hookCategory, (hookCounts.get(m.hookCategory) || 0) + m.purchasedCount);
        }
      }
      const bestHook = [...hookCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

      // Top media type
      const typeCounts = new Map<string, number>();
      for (const m of msgs) {
        typeCounts.set(m.mediaType, (typeCounts.get(m.mediaType) || 0) + 1);
      }
      const topMediaType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "text-only";

      return { ...agg, messages: msgs, bestHook, topMediaType } as CreatorSummary;
    }).sort((a, b) => {
      if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
      if (sortBy === "count") return b.count - a.count;
      return b.conversionRate - a.conversionRate;
    });
  }, [creatorPerformance, allDirect, allMass, sortBy]);

  if (creators.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-white/30 text-sm">
        <Megaphone size={14} className="mr-2 opacity-50" /> No creator data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Sort controls */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-white/25 text-[10px] mr-1">Sort:</span>
        {(["revenue", "count", "cvr"] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition ${sortBy === s ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"}`}>
            {s === "revenue" ? "Revenue" : s === "count" ? "Messages" : "CVR"}
          </button>
        ))}
        <span className="text-white/15 text-[10px] ml-auto">{creators.length} creators — click to expand</span>
      </div>

      {/* Creator list */}
      <div className="space-y-1.5 max-h-[700px] overflow-y-auto custom-scrollbar">
        {creators.map(c => (
          <CreatorCard
            key={c.name}
            creator={c}
            expanded={expandedCreator === c.name}
            onToggle={() => setExpandedCreator(expandedCreator === c.name ? null : c.name)}
          />
        ))}
      </div>
    </div>
  );
}

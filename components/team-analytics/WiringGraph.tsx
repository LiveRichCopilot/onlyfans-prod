"use client";

import { X } from "lucide-react";

type Chatter = { email: string; name: string; source: "override" | "live" | "assigned"; detail: string; overrideId?: string; isLive: boolean };

export type WiringNode = {
  id: string;
  name: string | null;
  ofUsername: string | null;
  avatarUrl: string | null;
  chatters: Chatter[];
};

const COL_W = 148;
const MODEL_H = 68;
const WIRE_TOP = 14;
const CHATTER_H = 46;
const CHATTER_GAP = 6;

export function WiringGraph({ nodes, onDisconnect }: { nodes: WiringNode[]; onDisconnect?: (email: string, creatorId: string) => void }) {
  const maxChatters = Math.max(1, ...nodes.map(n => n.chatters.length));
  const chatterZoneH = maxChatters * (CHATTER_H + CHATTER_GAP);
  const totalH = MODEL_H + WIRE_TOP + chatterZoneH + 16;
  const totalW = nodes.length * COL_W + 16;

  return (
    <div className="overflow-x-auto px-2 py-3">
      <div className="relative" style={{ width: totalW, height: totalH, minWidth: "100%" }}>
        {/* SVG gradient defs — shared across all wires */}
        <svg width={0} height={0} className="absolute">
          <defs>
            <linearGradient id="wire-missing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>

        {nodes.map((node, i) => {
          const x = i * COL_W + 8;
          const hasChatters = node.chatters.length > 0;
          const hasLive = node.chatters.some(c => c.isLive);
          const hasOverride = node.chatters.some(c => c.source === "override");
          // Scheduled but nobody live = teal/red gradient border
          const hasOnlyScheduled = hasChatters && !hasLive && !hasOverride;
          const borderColor = hasOverride ? "border-orange-500/30 bg-orange-500/5"
            : hasLive ? "border-teal-500/30 bg-teal-500/5"
            : hasOnlyScheduled ? "border-amber-500/30 bg-amber-500/[0.04]"
            : "border-red-500/20 bg-red-500/5";

          return (
            <div key={node.id} className="absolute" style={{ left: x, top: 0, width: COL_W - 8 }}>
              {/* Model card */}
              <div className={`rounded-xl border px-2 py-2 flex items-center gap-2 ${borderColor}`} style={{ height: MODEL_H }}>
                {node.avatarUrl ? (
                  <img src={`/api/proxy-media?url=${encodeURIComponent(node.avatarUrl)}`} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40 font-bold flex-shrink-0">
                    {(node.name || "?")[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-white/90 truncate">{node.name || "Unknown"}</div>
                  {node.ofUsername && <div className="text-[9px] text-white/25 truncate">@{node.ofUsername}</div>}
                </div>
                {hasLive && <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 bg-teal-400" />}
                {hasOnlyScheduled && <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 bg-amber-400" />}
              </div>

              {/* Wires + chatter cards */}
              {hasChatters ? (
                <div className="relative" style={{ height: WIRE_TOP + chatterZoneH }}>
                  <svg width={COL_W - 8} height={WIRE_TOP + chatterZoneH} className="absolute top-0 left-0 pointer-events-none">
                    {node.chatters.map((ch, ci) => {
                      const cx = (COL_W - 8) / 2;
                      const endY = WIRE_TOP + ci * (CHATTER_H + CHATTER_GAP) + CHATTER_H / 2;
                      // Live = solid teal, Override = orange, Not clocked in = teal→amber→red gradient
                      const wireStroke = ch.source === "override" ? "#f97316" : ch.isLive ? "#2dd4bf" : "url(#wire-missing)";

                      const d = node.chatters.length === 1
                        ? `M ${cx} 0 L ${cx} ${endY}`
                        : `M ${cx} 0 L ${cx} ${WIRE_TOP * 0.6} Q ${cx} ${WIRE_TOP}, ${cx} ${WIRE_TOP} L ${cx} ${endY}`;

                      return (
                        <g key={ch.email}>
                          <path d={d} fill="none" stroke={wireStroke} strokeWidth={1.5} opacity={ch.isLive ? 0.5 : 0.6} />
                          {ch.isLive && (
                            <>
                              <circle r="2.5" fill="#2dd4bf">
                                <animateMotion dur="2s" repeatCount="indefinite" path={d} />
                              </circle>
                              <circle r="5" fill="#2dd4bf" opacity={0.12}>
                                <animateMotion dur="2s" repeatCount="indefinite" path={d} />
                              </circle>
                            </>
                          )}
                          {/* Not clocked in: slow pulsing dot traveling down the gradient wire */}
                          {!ch.isLive && ch.source === "assigned" && (
                            <circle r="2" fill="#f59e0b" opacity={0.5}>
                              <animateMotion dur="4s" repeatCount="indefinite" path={d} />
                            </circle>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Chatter cards */}
                  {node.chatters.map((ch, ci) => {
                    const isOvr = ch.source === "override";
                    const top = WIRE_TOP + ci * (CHATTER_H + CHATTER_GAP);
                    const cardBorder = isOvr ? "border-orange-500/20 bg-orange-500/[0.03]"
                      : ch.isLive ? "border-teal-500/20 bg-teal-500/[0.03]"
                      : "border-amber-500/20 bg-amber-500/[0.04]";
                    const detailColor = isOvr ? "#f9731660" : ch.isLive ? "#2dd4bf60" : "#f59e0b70";

                    return (
                      <div key={ch.email} className={`absolute left-0 right-0 rounded-xl border px-2 py-1.5 flex items-center gap-1.5 group ${cardBorder}`} style={{ top, height: CHATTER_H }}>
                        <div className="relative w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/50 font-bold uppercase flex-shrink-0">
                          {ch.name[0]}
                          {ch.isLive && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#0a0a0f] animate-pulse" />
                          )}
                          {!ch.isLive && ch.source === "assigned" && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-[#0a0a0f]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-medium text-white/90 truncate">{ch.name}</div>
                          <div className="text-[8px] truncate" style={{ color: detailColor }}>
                            {ch.isLive ? `LIVE · ${ch.detail}` : `NOT CLOCKED IN · ${ch.detail}`}
                          </div>
                        </div>
                        {onDisconnect && (
                          <button
                            onClick={() => onDisconnect(ch.email, node.id)}
                            className="opacity-0 group-hover:opacity-100 transition w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 hover:bg-red-500/40"
                            title="Disconnect"
                          >
                            <X size={8} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center" style={{ height: WIRE_TOP + CHATTER_H }}>
                  <div className="text-[10px] text-red-400/40 italic">No chatter</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

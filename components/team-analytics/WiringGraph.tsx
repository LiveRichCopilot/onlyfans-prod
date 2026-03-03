"use client";

import { X } from "lucide-react";

type Chatter = { email: string; name: string; source: "override" | "live" | "assigned"; detail: string; overrideId?: string };

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
        {nodes.map((node, i) => {
          const x = i * COL_W + 8;
          const hasChatters = node.chatters.length > 0;
          const hasLive = node.chatters.some(c => c.source === "live");
          const hasOverride = node.chatters.some(c => c.source === "override");
          const borderColor = hasOverride ? "border-orange-500/30 bg-orange-500/5"
            : hasLive ? "border-teal-500/30 bg-teal-500/5"
            : hasChatters ? "border-white/10 bg-white/[0.02]"
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
              </div>

              {/* Wires + chatter cards */}
              {hasChatters ? (
                <div className="relative" style={{ height: WIRE_TOP + chatterZoneH }}>
                  <svg width={COL_W - 8} height={WIRE_TOP + chatterZoneH} className="absolute top-0 left-0 pointer-events-none">
                    {node.chatters.map((ch, ci) => {
                      const cx = (COL_W - 8) / 2;
                      const endY = WIRE_TOP + ci * (CHATTER_H + CHATTER_GAP) + CHATTER_H / 2;
                      const isLive = ch.source === "live" || ch.source === "override";
                      const wireColor = ch.source === "override" ? "#f97316" : isLive ? "#2dd4bf" : "rgba(255,255,255,0.12)";

                      const d = node.chatters.length === 1
                        ? `M ${cx} 0 L ${cx} ${endY}`
                        : `M ${cx} 0 L ${cx} ${WIRE_TOP * 0.6} Q ${cx} ${WIRE_TOP}, ${cx} ${WIRE_TOP} L ${cx} ${endY}`;

                      return (
                        <g key={ch.email}>
                          <path d={d} fill="none" stroke={wireColor} strokeWidth={1.5} opacity={isLive ? 0.5 : 0.3} />
                          {isLive && (
                            <>
                              <circle r="2.5" fill={wireColor}>
                                <animateMotion dur="2s" repeatCount="indefinite" path={d} />
                              </circle>
                              <circle r="5" fill={wireColor} opacity={0.12}>
                                <animateMotion dur="2s" repeatCount="indefinite" path={d} />
                              </circle>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Chatter cards */}
                  {node.chatters.map((ch, ci) => {
                    const isLive = ch.source === "live" || ch.source === "override";
                    const isOvr = ch.source === "override";
                    const top = WIRE_TOP + ci * (CHATTER_H + CHATTER_GAP);
                    const cardBorder = isOvr ? "border-orange-500/20 bg-orange-500/[0.03]"
                      : isLive ? "border-teal-500/20 bg-teal-500/[0.03]"
                      : "border-white/10 bg-white/[0.02]";
                    const detailColor = isOvr ? "#f9731660" : isLive ? "#2dd4bf60" : "rgba(255,255,255,0.2)";

                    return (
                      <div key={ch.email} className={`absolute left-0 right-0 rounded-xl border px-2 py-1.5 flex items-center gap-1.5 group ${cardBorder}`} style={{ top, height: CHATTER_H }}>
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[8px] text-white/50 font-bold uppercase flex-shrink-0">
                          {ch.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-medium text-white/90 truncate">{ch.name}</div>
                          <div className="text-[8px] truncate" style={{ color: detailColor }}>
                            {ch.detail}
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

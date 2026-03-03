"use client";

export type WiringNode = {
  id: string;
  name: string | null;
  ofUsername: string | null;
  avatarUrl: string | null;
  chatter: {
    email: string;
    name: string;
    source: "override" | "live";
    detail: string;
  } | null;
};

const COL_W = 140;
const MODEL_H = 70;
const WIRE_H = 50;
const CHATTER_H = 52;
const TOTAL_H = MODEL_H + WIRE_H + CHATTER_H + 16;

export function WiringGraph({ nodes }: { nodes: WiringNode[] }) {
  const totalW = nodes.length * COL_W + 16;

  return (
    <div className="overflow-x-auto px-2 py-3">
      <div className="relative" style={{ width: totalW, height: TOTAL_H, minWidth: "100%" }}>
        {nodes.map((node, i) => {
          const x = i * COL_W + 8;
          const hasChatter = !!node.chatter;
          const isOverride = node.chatter?.source === "override";
          const wireColor = isOverride ? "#f97316" : "#2dd4bf";

          return (
            <div key={node.id} className="absolute" style={{ left: x, top: 0, width: COL_W - 8 }}>
              {/* Model card */}
              <div className={`rounded-xl border px-2 py-2 flex items-center gap-2 ${
                hasChatter
                  ? isOverride ? "border-orange-500/30 bg-orange-500/5" : "border-teal-500/30 bg-teal-500/5"
                  : "border-red-500/20 bg-red-500/5"
              }`} style={{ height: MODEL_H }}>
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
                {hasChatter && <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: wireColor }} />}
              </div>

              {/* Wire + chatter or empty state */}
              {hasChatter ? (
                <>
                  {/* SVG wire with animated dot */}
                  <svg width={COL_W - 8} height={WIRE_H} className="block">
                    <line x1={(COL_W - 8) / 2} y1={0} x2={(COL_W - 8) / 2} y2={WIRE_H}
                      stroke={wireColor} strokeWidth={2} opacity={0.6} />
                    {/* Electricity dot */}
                    <circle r="3" fill={wireColor}>
                      <animate attributeName="cy" values={`0;${WIRE_H};0`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="cx" values={`${(COL_W - 8) / 2};${(COL_W - 8) / 2};${(COL_W - 8) / 2}`} dur="2s" repeatCount="indefinite" />
                    </circle>
                    {/* Glow trail */}
                    <circle r="6" fill={wireColor} opacity={0.15}>
                      <animate attributeName="cy" values={`0;${WIRE_H};0`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="cx" values={`${(COL_W - 8) / 2};${(COL_W - 8) / 2};${(COL_W - 8) / 2}`} dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>

                  {/* Chatter card */}
                  <div className={`rounded-xl border px-2 py-2 flex items-center gap-2 ${
                    isOverride ? "border-orange-500/20 bg-orange-500/[0.03]" : "border-teal-500/20 bg-teal-500/[0.03]"
                  }`} style={{ height: CHATTER_H }}>
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/50 font-bold uppercase flex-shrink-0">
                      {node.chatter!.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-white/90 truncate">{node.chatter!.name}</div>
                      <div className="text-[9px] truncate" style={{ color: isOverride ? "#f9731680" : "#2dd4bf80" }}>
                        {node.chatter!.detail}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center" style={{ height: WIRE_H + CHATTER_H }}>
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

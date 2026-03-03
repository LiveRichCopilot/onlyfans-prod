"use client";

import { useState, useMemo } from "react";
import type { WiringData, WiringConnection } from "./WiringPanel";

const NODE_H = 48;
const GAP = 8;
const LEFT_W = 155;
const RIGHT_W = 155;
const SVG_W = 600;
const LEFT_X = 0;
const RIGHT_X = SVG_W - RIGHT_W;

const COLORS: Record<string, { stroke: string; glow: string }> = {
  override: { stroke: "#f97316", glow: "rgba(249,115,22,0.3)" },
  live: { stroke: "#2dd4bf", glow: "rgba(45,212,191,0.3)" },
  scheduled: { stroke: "#6b7280", glow: "none" },
};

type PathData = { conn: WiringConnection; y1: number; y2: number; d: string; key: string };

export function WiringGraph({ data }: { data: WiringData }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const creatorY = useMemo(() => {
    const m = new Map<string, number>();
    data.creators.forEach((c, i) => m.set(c.id, i * (NODE_H + GAP)));
    return m;
  }, [data.creators]);

  const chatterY = useMemo(() => {
    const m = new Map<string, number>();
    data.chatters.forEach((c, i) => m.set(c.email, i * (NODE_H + GAP)));
    return m;
  }, [data.chatters]);

  const svgH = Math.max(
    data.creators.length * (NODE_H + GAP),
    data.chatters.length * (NODE_H + GAP),
    120,
  );

  const paths: PathData[] = useMemo(() => {
    return data.connections.map(conn => {
      const cy = creatorY.get(conn.creatorId);
      const chy = chatterY.get(conn.chatterEmail);
      if (cy === undefined || chy === undefined) return null;
      const y1 = cy + NODE_H / 2;
      const y2 = chy + NODE_H / 2;
      const x1 = LEFT_X + LEFT_W;
      const x2 = RIGHT_X;
      const cx = (x1 + x2) / 2;
      return {
        conn, y1, y2,
        d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
        key: `${conn.chatterEmail}::${conn.creatorId}`,
      };
    }).filter(Boolean) as PathData[];
  }, [data.connections, creatorY, chatterY]);

  return (
    <div className="px-6 py-4 overflow-x-auto">
      <div className="relative" style={{ minWidth: SVG_W, minHeight: svgH }}>
        {/* Creator nodes (left) */}
        {data.creators.map(c => {
          const y = creatorY.get(c.id);
          if (y === undefined) return null;
          const hasLive = data.connections.some(cn => cn.creatorId === c.id && cn.source === "live");
          const hasOvr = data.connections.some(cn => cn.creatorId === c.id && cn.source === "override");
          return (
            <div key={c.id} className="absolute" style={{ left: LEFT_X, top: y, width: LEFT_W, height: NODE_H }}>
              <div className={`h-full rounded-xl border px-3 flex items-center gap-2 ${
                hasOvr ? "border-orange-500/40 bg-orange-500/5" : hasLive ? "border-teal-500/40 bg-teal-500/5" : "border-white/10 bg-white/[0.02]"
              }`}>
                {c.avatarUrl ? (
                  <img src={`/api/proxy-media?url=${encodeURIComponent(c.avatarUrl)}`} className="w-7 h-7 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40 font-bold">
                    {(c.name || "?")[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white/90 truncate">{c.name || "Unknown"}</div>
                  {c.ofUsername && <div className="text-[9px] text-white/30 truncate">@{c.ofUsername}</div>}
                </div>
                {hasLive && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />}
              </div>
            </div>
          );
        })}

        {/* Chatter nodes (right) */}
        {data.chatters.map(ch => {
          const y = chatterY.get(ch.email);
          if (y === undefined) return null;
          const isLive = data.connections.some(cn => cn.chatterEmail === ch.email && cn.source === "live");
          const hasOvr = data.connections.some(cn => cn.chatterEmail === ch.email && cn.source === "override");
          return (
            <div key={ch.email} className="absolute" style={{ left: RIGHT_X, top: y, width: RIGHT_W, height: NODE_H }}>
              <div className={`h-full rounded-xl border px-3 flex items-center gap-2 ${
                hasOvr ? "border-orange-500/40 bg-orange-500/5" : isLive ? "border-teal-500/40 bg-teal-500/5" : "border-white/10 bg-white/[0.02]"
              }`}>
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/50 font-bold uppercase">
                  {ch.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white/90 truncate">{ch.name}</div>
                  <div className="text-[9px] text-white/30 truncate">{ch.email}</div>
                </div>
                {isLive && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />}
              </div>
            </div>
          );
        })}

        {/* SVG connector lines */}
        <svg className="absolute top-0 left-0 pointer-events-none" width={SVG_W} height={svgH} style={{ overflow: "visible" }}>
          {paths.map(({ conn, y1, y2, d, key }) => {
            const c = COLORS[conn.source];
            const isHov = hovered === key;
            const anyHov = hovered !== null;
            const op = anyHov ? (isHov ? 1 : 0.12) : conn.source === "scheduled" ? 0.3 : 0.7;
            const mid = { x: (LEFT_W + RIGHT_X) / 2, y: (y1 + y2) / 2 };

            return (
              <g key={key}>
                <path d={d} fill="none" stroke={c.stroke} strokeWidth={isHov ? 3 : 1.5} opacity={op}
                  className="transition-all duration-200" style={{ pointerEvents: "stroke" }}
                  onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)} />
                {conn.source === "live" && (
                  <circle r="3" fill={c.stroke} opacity={op}>
                    <animateMotion dur="3s" repeatCount="indefinite" path={d} />
                  </circle>
                )}
                {conn.source === "override" && (
                  <circle cx={mid.x} cy={mid.y} r="4" fill={c.stroke} opacity={op}>
                    <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (() => {
          const p = paths.find(x => x.key === hovered);
          if (!p) return null;
          return (
            <div className="absolute px-2.5 py-1.5 rounded-lg bg-[#1a1a2e] border border-white/10 text-[10px] text-white/70 whitespace-nowrap z-30 shadow-lg"
              style={{ left: (LEFT_W + RIGHT_X) / 2 - 50, top: (p.y1 + p.y2) / 2 - 28 }}>
              <span style={{ color: COLORS[p.conn.source].stroke }} className="font-medium capitalize">{p.conn.source}</span>
              {p.conn.detail && <span className="ml-1.5 text-white/40">{p.conn.detail}</span>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

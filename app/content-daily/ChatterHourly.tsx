"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Clock } from "lucide-react";
import type { ContentItem } from "./ContentCard";

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

type ChatterHourData = {
  chatter: string;
  hours: number[]; // 24 slots, count per hour
  total: number;
  sold: number;
  models: string[];
};

export default function ChatterHourly({
  items,
  expanded,
  onToggle,
}: {
  items: ContentItem[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [dayFilter, setDayFilter] = useState<string>("all");

  const dmItems = useMemo(() => items.filter((i) => i.source === "direct_message"), [items]);

  // Available dates from DM items
  const dates = useMemo(() => {
    const set = new Set<string>();
    dmItems.forEach((i) => {
      const d = i.sentAtUk.split(",")[0]?.trim(); // "13/03/2026"
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => {
      const [da, ma, ya] = a.split("/");
      const [db, mb, yb] = b.split("/");
      return `${yb}${mb}${db}`.localeCompare(`${ya}${ma}${da}`);
    });
  }, [dmItems]);

  const data = useMemo(() => {
    const filtered = dayFilter === "all" ? dmItems : dmItems.filter((i) => i.sentAtUk.split(",")[0]?.trim() === dayFilter);
    const map = new Map<string, { hours: number[]; sold: number; models: Set<string> }>();

    for (const item of filtered) {
      const chatter = item.chatterName || "Unassigned";
      const entry = map.get(chatter) || { hours: new Array(24).fill(0), sold: 0, models: new Set<string>() };
      // Parse hour from sentAtUk — format: "13/03/2026, 21:40:05"
      const timePart = item.sentAtUk.split(",")[1]?.trim() || "";
      const hourStr = timePart.split(":")[0];
      const hour = parseInt(hourStr);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        entry.hours[hour]++;
      }
      if (item.status === "selling") entry.sold++;
      entry.models.add(item.creator.name);
      map.set(chatter, entry);
    }

    const rows: ChatterHourData[] = [];
    for (const [chatter, entry] of map) {
      rows.push({
        chatter,
        hours: entry.hours,
        total: entry.hours.reduce((s, v) => s + v, 0),
        sold: entry.sold,
        models: [...entry.models],
      });
    }
    return rows.sort((a, b) => b.total - a.total);
  }, [dmItems, dayFilter]);

  if (dmItems.length === 0) return null;

  const maxCount = Math.max(...data.flatMap((d) => d.hours), 1);

  return (
    <div className="glass-card rounded-2xl mb-6 overflow-hidden">
      <button onClick={() => onToggle("chatter-hourly")} className="w-full flex items-center justify-between p-4 text-left">
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock size={14} className="text-orange-400" />
          Chatter Activity by Hour
          <span className="text-xs text-white/40 font-normal">{data.length} chatters</span>
        </span>
        <ChevronDown size={16} className={`text-white/50 transition-transform ${expanded.has("chatter-hourly") ? "rotate-180" : ""}`} />
      </button>
      {expanded.has("chatter-hourly") && (
        <div className="px-4 pb-4">
          {/* Day filter */}
          {dates.length > 1 && (
            <div className="flex gap-1 mb-3 flex-wrap">
              <button onClick={() => setDayFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${dayFilter === "all" ? "bg-teal-500/20 text-teal-400" : "text-white/50"}`}>
                All Days
              </button>
              {dates.map((d) => (
                <button key={d} onClick={() => setDayFilter(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${dayFilter === d ? "bg-teal-500/20 text-teal-400" : "text-white/50"}`}>
                  {d.slice(0, 5)}
                </button>
              ))}
            </div>
          )}
          {/* Heatmap */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1.5 pr-3 text-white/50 font-medium sticky left-0 bg-[#0a0a0f] z-10 min-w-[120px]">Chatter</th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="text-center py-1.5 px-0 text-white/30 font-normal w-8 min-w-[28px]">
                      {h % 3 === 0 ? hourLabel(h) : ""}
                    </th>
                  ))}
                  <th className="text-right py-1.5 pl-3 text-white/50 font-medium min-w-[50px]">Total</th>
                  <th className="text-right py-1.5 pl-2 text-white/50 font-medium min-w-[40px]">Sold</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.chatter} className="group">
                    <td className="py-1 pr-3 sticky left-0 bg-[#0a0a0f] z-10">
                      <div className="text-purple-400 font-medium truncate max-w-[120px]">{row.chatter}</div>
                      <div className="text-[9px] text-white/30 truncate max-w-[120px]">{row.models.join(", ")}</div>
                    </td>
                    {row.hours.map((count, h) => {
                      const intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0;
                      return (
                        <td key={h} className="py-1 px-0 text-center relative">
                          {count > 0 ? (
                            <div className="mx-auto w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold"
                              style={{ backgroundColor: `rgba(168, 85, 247, ${intensity})`, color: intensity > 0.4 ? "#fff" : "rgba(255,255,255,0.7)" }}>
                              {count}
                            </div>
                          ) : (
                            <div className="mx-auto w-6 h-6 rounded-sm bg-white/[0.02]" />
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1 pl-3 text-right text-white font-bold">{row.total}</td>
                    <td className="py-1 pl-2 text-right">
                      <span className={row.sold > 0 ? "text-emerald-400 font-bold" : "text-white/30"}>{row.sold}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

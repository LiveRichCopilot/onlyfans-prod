"use client";

import { useState } from "react";
import { Search, GripVertical } from "lucide-react";
import { getChatterColor } from "./ShiftBlock";

type Chatter = { email: string; name: string };
type Shift = { chatterEmail: string };

type Props = {
  chatters: Chatter[];
  shifts: Shift[];
  liveEmails?: Set<string>;
};

export function ChatterPalette({ chatters, shifts, liveEmails }: Props) {
  const [search, setSearch] = useState("");

  const scheduledEmails = new Set(shifts.map((s) => s.chatterEmail));
  const query = search.toLowerCase().trim();

  const filtered = chatters.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query)
  );

  function handleDragStart(e: React.DragEvent, chatter: Chatter) {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "new",
        chatterEmail: chatter.email,
        chatterName: chatter.name,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 min-w-[200px] max-h-[600px]">
      <h3 className="text-sm font-semibold text-white/70">Chatters</h3>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Chatter List */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1">
        {filtered.map((c) => {
          const color = getChatterColor(c.email);
          const isScheduled = scheduledEmails.has(c.email);
          const isLive = liveEmails?.has(c.email) ?? false;

          return (
            <div
              key={c.email}
              draggable
              onDragStart={(e) => handleDragStart(e, c)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
              style={{
                borderLeft: `3px solid ${color}`,
              }}
            >
              <GripVertical size={12} className="text-white/20 flex-shrink-0" />
              {isLive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              )}
              <span className="text-xs font-medium text-white/80 truncate flex-1">
                {c.name}
              </span>
              {!isScheduled && (
                <span className="text-[9px] text-white/25 flex-shrink-0">
                  unset
                </span>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-white/30 text-center py-4">No chatters found</p>
        )}
      </div>

      <div className="text-[10px] text-white/25 text-center">
        Drag onto a shift slot to assign
      </div>
    </div>
  );
}
